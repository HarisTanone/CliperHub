"""
Frame-by-Frame Face Crop Pipeline
==================================
Speaker Switch Rules:
- face_id = cx // 200 (stabil, toleransi gerak ±100px)
- Kandidat harus bicara >= 30 frame berturut-turut sebelum switch (~1.2s di 25fps)
- Variance kandidat harus > 4x variance speaker aktif
- Cooldown 90 frame (~3.6s di 25fps) setelah switch

Grid Mode Rules:
- Grid MASUK hanya jika 2 wajah >= 3 detik berturut-turut (fps-aware)
- Grid KELUAR hanya jika kembali ke 1 wajah >= 1.5 detik
- Grid mode pakai smoother terpisah alpha=0.05 agar tidak goyang
"""
import os
os.environ['GLOG_minloglevel'] = '3'
os.environ['GLOG_logtostderr'] = '0'

import cv2
import numpy as np
import subprocess
import tempfile
from typing import List, Dict, Tuple, Optional
from collections import deque

# MediaPipe imported lazily to suppress warnings
_mp = None
def _get_mediapipe():
    global _mp
    if _mp is None:
        import mediapipe as mp
        _mp = mp
    return _mp


class AdaptiveSmoother:
    """Smooth camera movement — slow for steady, fast for sudden changes"""
    
    def __init__(self, alpha_fast=0.10, alpha_slow=0.02, threshold=60):
        self.alpha_fast = alpha_fast
        self.alpha_slow = alpha_slow
        self.threshold = threshold
        self._prev = None
        self._smooth = None
    
    def update(self, pos: Tuple[int, int]) -> Tuple[int, int]:
        if self._smooth is None:
            self._smooth = pos
            self._prev = pos
            return pos
        
        motion = np.sqrt((pos[0] - self._prev[0])**2 + (pos[1] - self._prev[1])**2)
        alpha = self.alpha_fast if motion > self.threshold else self.alpha_slow
        
        sx = int(alpha * pos[0] + (1 - alpha) * self._smooth[0])
        sy = int(alpha * pos[1] + (1 - alpha) * self._smooth[1])
        
        self._prev = pos
        self._smooth = (sx, sy)
        return self._smooth
    
    def reset(self):
        self._prev = None
        self._smooth = None


class FaceDetector:
    """
    Multi-method face detector — extremely robust for any angle.
    
    Chain:
    1. OpenCV DNN (SSD MobileNet) — fast, reliable, works for side angles
    2. MediaPipe Face Detection — backup
    3. MediaPipe Face Mesh — for mouth landmark precision
    """
    
    def __init__(self):
        self._dnn_net = None
        self._mp_face_detection = None
        self._mp_face_mesh = None
        self._initialized = False
    
    def _init(self):
        if self._initialized:
            return
        self._initialized = True
        
        # Method 1: OpenCV DNN face detector
        try:
            prototxt = os.path.join(os.path.dirname(__file__), 'models', 'deploy.prototxt')
            caffemodel = os.path.join(os.path.dirname(__file__), 'models', 
                                      'res10_300x300_ssd_iter_140000.caffemodel')
            
            if os.path.exists(prototxt) and os.path.exists(caffemodel):
                self._dnn_net = cv2.dnn.readNetFromCaffe(prototxt, caffemodel)
                print("[FaceDetect] ✅ OpenCV DNN model loaded")
            else:
                print(f"[FaceDetect] ⚠️ DNN model files not found, will download...")
                self._download_dnn_model(prototxt, caffemodel)
                if os.path.exists(prototxt) and os.path.exists(caffemodel):
                    self._dnn_net = cv2.dnn.readNetFromCaffe(prototxt, caffemodel)
                    print("[FaceDetect] ✅ OpenCV DNN model downloaded and loaded")
        except Exception as e:
            print(f"[FaceDetect] ⚠️ DNN init failed: {e}")
        
        # Method 2 & 3: MediaPipe
        try:
            mp = _get_mediapipe()
            import contextlib
            with open(os.devnull, 'w') as devnull:
                with contextlib.redirect_stderr(devnull):
                    with contextlib.redirect_stdout(devnull):
                        # Face Detection (faster, more robust for various angles)
                        self._mp_face_detection = mp.solutions.face_detection.FaceDetection(
                            model_selection=1,  # 1 = full range model (better for far faces)
                            min_detection_confidence=0.25
                        )
                        # Face Mesh (for mouth landmarks)
                        self._mp_face_mesh = mp.solutions.face_mesh.FaceMesh(
                            static_image_mode=False,
                            max_num_faces=5,
                            refine_landmarks=True,
                            min_detection_confidence=0.25,
                            min_tracking_confidence=0.25
                        )
            print("[FaceDetect] ✅ MediaPipe models loaded")
        except Exception as e:
            print(f"[FaceDetect] ⚠️ MediaPipe init failed: {e}")
    
    def _download_dnn_model(self, prototxt_path: str, caffemodel_path: str):
        """Download OpenCV DNN face detection model"""
        import urllib.request
        
        os.makedirs(os.path.dirname(prototxt_path), exist_ok=True)
        
        prototxt_url = "https://raw.githubusercontent.com/opencv/opencv/master/samples/dnn/face_detector/deploy.prototxt"
        caffemodel_url = "https://raw.githubusercontent.com/opencv/opencv_3rdparty/dnn_samples_face_detector_20170830/res10_300x300_ssd_iter_140000.caffemodel"
        
        try:
            if not os.path.exists(prototxt_path):
                print("[FaceDetect] Downloading deploy.prototxt...")
                urllib.request.urlretrieve(prototxt_url, prototxt_path)
            if not os.path.exists(caffemodel_path):
                print("[FaceDetect] Downloading caffemodel (10MB)...")
                urllib.request.urlretrieve(caffemodel_url, caffemodel_path)
        except Exception as e:
            print(f"[FaceDetect] Download failed: {e}")
    
    def detect_face(self, frame: np.ndarray) -> Optional[Dict]:
        """
        Detect the most prominent face in a frame.
        Returns dict with: face_center (x,y), mouth_center (x,y), face_box (x,y,w,h)
        """
        self._init()
        h, w = frame.shape[:2]
        
        # Try Method 1: OpenCV DNN (most reliable)
        if self._dnn_net is not None:
            result = self._detect_dnn(frame, h, w)
            if result:
                # Try to get mouth position from MediaPipe Face Mesh
                mouth = self._detect_mouth_mediapipe(frame, h, w, result)
                if mouth:
                    result['mouth_center'] = mouth['mouth_center']
                    result['mouth_open'] = mouth['mouth_open']
                return result
        
        # Try Method 2: MediaPipe Face Detection
        if self._mp_face_detection is not None:
            result = self._detect_mp_face(frame, h, w)
            if result:
                mouth = self._detect_mouth_mediapipe(frame, h, w, result)
                if mouth:
                    result['mouth_center'] = mouth['mouth_center']
                    result['mouth_open'] = mouth['mouth_open']
                return result
        
        # Try Method 3: MediaPipe Face Mesh directly
        if self._mp_face_mesh is not None:
            result = self._detect_mesh_direct(frame, h, w)
            if result:
                return result
        
        return None
    
    def detect_all_faces(self, frame: np.ndarray) -> List[Dict]:
        """Detect ALL faces in frame (for speaker detection)"""
        self._init()
        h, w = frame.shape[:2]
        faces = []
        
        # Use DNN for all faces
        if self._dnn_net is not None:
            faces = self._detect_dnn_all(frame, h, w)
        
        # ALSO try MediaPipe if DNN found <= 1 face (DNN often misses 2nd person)
        if len(faces) <= 1 and self._mp_face_detection is not None:
            mp_faces = self._detect_mp_face_all(frame, h, w)
            if mp_faces:
                if not faces:
                    # DNN found nothing, use MediaPipe entirely
                    faces = mp_faces
                else:
                    # DNN found 1 face, merge with MediaPipe results (dedup)
                    for mp_face in mp_faces:
                        is_duplicate = False
                        for dnn_face in faces:
                            dist = abs(mp_face['face_center'][0] - dnn_face['face_center'][0]) + \
                                   abs(mp_face['face_center'][1] - dnn_face['face_center'][1])
                            if dist < 100:  # Same face if centers within 100px
                                is_duplicate = True
                                break
                        if not is_duplicate:
                            faces.append(mp_face)
        
        # Get mouth info for each face via Face Mesh
        if faces and self._mp_face_mesh is not None:
            self._enrich_with_mouth(frame, h, w, faces)
        
        return faces
    
    def _detect_dnn(self, frame, h, w) -> Optional[Dict]:
        """OpenCV DNN face detection — single best face"""
        blob = cv2.dnn.blobFromImage(frame, 1.0, (300, 300), (104, 177, 123))
        self._dnn_net.setInput(blob)
        detections = self._dnn_net.forward()
        
        best = None
        best_conf = 0
        
        for i in range(detections.shape[2]):
            confidence = detections[0, 0, i, 2]
            if confidence > 0.4 and confidence > best_conf:  # Confidence threshold
                box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
                x1, y1, x2, y2 = box.astype(int)
                
                # Validate box
                bw = x2 - x1
                bh = y2 - y1
                if bw > 30 and bh > 30 and x1 >= 0 and y1 >= 0:
                    cx = (x1 + x2) // 2
                    cy = (y1 + y2) // 2
                    # Default mouth position = lower third of face
                    mouth_y = y1 + int(bh * 0.75)
                    
                    best = {
                        'face_center': (cx, cy),
                        'mouth_center': (cx, mouth_y),
                        'mouth_open': 0,
                        'face_box': (x1, y1, bw, bh),
                        'confidence': float(confidence),
                    }
                    best_conf = confidence
        
        return best
    
    def _detect_dnn_all(self, frame, h, w) -> List[Dict]:
        """OpenCV DNN — all faces"""
        blob = cv2.dnn.blobFromImage(frame, 1.0, (300, 300), (104, 177, 123))
        self._dnn_net.setInput(blob)
        detections = self._dnn_net.forward()
        
        faces = []
        for i in range(detections.shape[2]):
            confidence = detections[0, 0, i, 2]
            if confidence > 0.35:
                box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
                x1, y1, x2, y2 = box.astype(int)
                bw = x2 - x1
                bh = y2 - y1
                if bw > 30 and bh > 30 and x1 >= 0 and y1 >= 0:
                    cx = (x1 + x2) // 2
                    cy = (y1 + y2) // 2
                    mouth_y = y1 + int(bh * 0.75)
                    face_id = cx // 200  # stable bucket
                    
                    faces.append({
                        'face_center': (cx, cy),
                        'mouth_center': (cx, mouth_y),
                        'mouth_open': 0,
                        'face_box': (x1, y1, bw, bh),
                        'face_id': face_id,
                        'confidence': float(confidence),
                    })
        
        return faces
    
    def _detect_mp_face(self, frame, h, w) -> Optional[Dict]:
        """MediaPipe Face Detection — single best face"""
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self._mp_face_detection.process(rgb)
        
        if not results.detections:
            return None
        
        # Take highest confidence face
        det = max(results.detections, key=lambda d: d.score[0])
        bb = det.location_data.relative_bounding_box
        
        x1 = int(bb.xmin * w)
        y1 = int(bb.ymin * h)
        bw = int(bb.width * w)
        bh = int(bb.height * h)
        cx = x1 + bw // 2
        cy = y1 + bh // 2
        mouth_y = y1 + int(bh * 0.75)
        
        return {
            'face_center': (cx, cy),
            'mouth_center': (cx, mouth_y),
            'mouth_open': 0,
            'face_box': (x1, y1, bw, bh),
            'confidence': float(det.score[0]),
        }
    
    def _detect_mp_face_all(self, frame, h, w) -> List[Dict]:
        """MediaPipe Face Detection — all faces"""
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self._mp_face_detection.process(rgb)
        
        if not results.detections:
            return []
        
        faces = []
        for det in results.detections:
            bb = det.location_data.relative_bounding_box
            x1 = int(bb.xmin * w)
            y1 = int(bb.ymin * h)
            bw = int(bb.width * w)
            bh = int(bb.height * h)
            cx = x1 + bw // 2
            cy = y1 + bh // 2
            mouth_y = y1 + int(bh * 0.75)
            face_id = cx // 200  # stable bucket
            
            faces.append({
                'face_center': (cx, cy),
                'mouth_center': (cx, mouth_y),
                'mouth_open': 0,
                'face_box': (x1, y1, bw, bh),
                'face_id': face_id,
                'confidence': float(det.score[0]),
            })
        
        return faces
    
    def _detect_mesh_direct(self, frame, h, w) -> Optional[Dict]:
        """MediaPipe Face Mesh — direct detection with mouth landmarks"""
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self._mp_face_mesh.process(rgb)
        
        if not results.multi_face_landmarks:
            return None
        
        lm = results.multi_face_landmarks[0].landmark
        
        upper = lm[13]
        lower = lm[14]
        mouth_cx = int((upper.x + lower.x) / 2 * w)
        mouth_cy = int((upper.y + lower.y) / 2 * h)
        
        forehead = lm[10]
        chin = lm[152]
        nose = lm[1]
        
        face_cx = int(nose.x * w)
        face_cy = int((forehead.y + chin.y) / 2 * h)
        face_h = int(abs(chin.y - forehead.y) * h)
        
        inner_upper = lm[82]
        inner_lower = lm[87]
        mouth_open = abs(inner_lower.y - inner_upper.y) * h / max(face_h, 1) * 100
        
        return {
            'face_center': (face_cx, face_cy),
            'mouth_center': (mouth_cx, mouth_cy),
            'mouth_open': float(mouth_open),
            'face_box': (face_cx - face_h//2, int(forehead.y * h), face_h, face_h),
            'confidence': 0.5,
        }
    
    def _detect_mouth_mediapipe(self, frame, h, w, face_info: Dict) -> Optional[Dict]:
        """Get precise mouth position using Face Mesh for a known face region"""
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self._mp_face_mesh.process(rgb)
        
        if not results.multi_face_landmarks:
            return None
        
        # Find the mesh face closest to the DNN-detected face
        fx, fy = face_info['face_center']
        best_mesh = None
        best_dist = float('inf')
        
        for face_landmarks in results.multi_face_landmarks:
            lm = face_landmarks.landmark
            nose = lm[1]
            mesh_x = int(nose.x * w)
            mesh_y = int(nose.y * h)
            dist = (mesh_x - fx)**2 + (mesh_y - fy)**2
            if dist < best_dist:
                best_dist = dist
                best_mesh = lm
        
        if best_mesh is None:
            return None
        
        lm = best_mesh
        upper = lm[13]
        lower = lm[14]
        mouth_cx = int((upper.x + lower.x) / 2 * w)
        mouth_cy = int((upper.y + lower.y) / 2 * h)
        
        forehead = lm[10]
        chin = lm[152]
        face_h = abs(chin.y - forehead.y) * h
        
        inner_upper = lm[82]
        inner_lower = lm[87]
        mouth_open = abs(inner_lower.y - inner_upper.y) * h / max(face_h, 1) * 100
        
        return {
            'mouth_center': (mouth_cx, mouth_cy),
            'mouth_open': float(mouth_open),
        }
    
    def _enrich_with_mouth(self, frame, h, w, faces: List[Dict]):
        """Add mouth data to face detections using Face Mesh"""
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self._mp_face_mesh.process(rgb)
        
        if not results.multi_face_landmarks:
            return
        
        for face_landmarks in results.multi_face_landmarks:
            lm = face_landmarks.landmark
            nose = lm[1]
            mesh_x = int(nose.x * w)
            
            # Match mesh face to DNN face by closest X position
            best_face = None
            best_dist = float('inf')
            for face in faces:
                fx = face['face_center'][0]
                dist = abs(mesh_x - fx)
                if dist < best_dist and dist < 200:  # Max 200px distance
                    best_dist = dist
                    best_face = face
            
            if best_face:
                upper = lm[13]
                lower = lm[14]
                mouth_cx = int((upper.x + lower.x) / 2 * w)
                mouth_cy = int((upper.y + lower.y) / 2 * h)
                
                forehead = lm[10]
                chin = lm[152]
                face_h = abs(chin.y - forehead.y) * h
                inner_upper = lm[82]
                inner_lower = lm[87]
                mouth_open = abs(inner_lower.y - inner_upper.y) * h / max(face_h, 1) * 100
                
                best_face['mouth_center'] = (mouth_cx, mouth_cy)
                best_face['mouth_open'] = float(mouth_open)
    
    def close(self):
        if self._mp_face_detection:
            self._mp_face_detection.close()
        if self._mp_face_mesh:
            self._mp_face_mesh.close()
    
    def __del__(self):
        self.close()


class SpeakerTracker:
    """
    Track which face is speaking based on mouth movement variance.

    Switch logic:
    - face_id ditentukan dari posisi X yang di-bucket dengan lebar 200px (lebih stabil)
    - Kandidat harus bicara >= min_speak_frames berturut-turut sebelum switch
    - Kandidat harus total bicara >= 3 detik (mencegah switch ke "oh ya", "oke baik")
    - Variance kandidat harus > 5x variance speaker aktif
    - Cooldown 120 frame (~4.8s di 25fps) setelah switch
    """

    def __init__(self, history_size=60, cooldown_frames=120, min_speak_frames=50):
        self.history_size = history_size
        self.cooldown_frames = cooldown_frames
        self.min_speak_frames = min_speak_frames
        self.min_total_speech_duration = 3.0  # Total harus bicara >= 3 detik
        self.mouth_histories: Dict[int, deque] = {}
        self.active_id = None
        self.cooldown = 0
        self._candidate_id = None
        self._candidate_frames = 0
        self._total_speech_frames: Dict[int, int] = {}  # Track total frames bicara per speaker

    def _face_id(self, face: Dict, frame_w: int = 1920) -> int:
        """Stable face_id: bucket X position by 200px zones"""
        cx = face.get('face_center', (0, 0))[0]
        return cx // 200

    def update(self, faces: List[Dict]) -> Optional[Dict]:
        """Given detected faces, return the active speaker"""
        if not faces:
            return None

        # Assign stable face_id
        for f in faces:
            f['face_id'] = self._face_id(f)

        if len(faces) == 1:
            f = faces[0]
            fid = f['face_id']
            self.active_id = fid
            self._candidate_id = None
            self._candidate_frames = 0
            if fid not in self.mouth_histories:
                self.mouth_histories[fid] = deque(maxlen=self.history_size)
            self.mouth_histories[fid].append(f.get('mouth_open', 0))
            return f

        # Multiple faces — track mouth movement
        current_ids = set()
        for f in faces:
            fid = f['face_id']
            current_ids.add(fid)
            if fid not in self.mouth_histories:
                self.mouth_histories[fid] = deque(maxlen=self.history_size)
                self._total_speech_frames[fid] = 0
            self.mouth_histories[fid].append(f.get('mouth_open', 0))
            
            # Increment total speech frames jika variance tinggi (sedang bicara)
            hist = self.mouth_histories[fid]
            if len(hist) >= 5:
                var = float(np.var(list(hist)))
                if var > 2.0:  # Threshold rendah untuk deteksi bicara
                    self._total_speech_frames[fid] += 1

        for fid in [k for k in self.mouth_histories if k not in current_ids]:
            del self.mouth_histories[fid]
            if fid in self._total_speech_frames:
                del self._total_speech_frames[fid]

        if self.cooldown > 0:
            self.cooldown -= 1

        # Find highest variance face
        best_face = None
        best_var = -1
        for f in faces:
            fid = f['face_id']
            hist = self.mouth_histories.get(fid, deque())
            if len(hist) >= 8:
                v = float(np.var(list(hist)))
                if v > best_var:
                    best_var = v
                    best_face = f

        if best_face:
            new_id = best_face['face_id']
            if self.active_id is None:
                self.active_id = new_id
            elif new_id != self.active_id and self.cooldown == 0:
                old_hist = self.mouth_histories.get(self.active_id, deque())
                old_var = float(np.var(list(old_hist))) if len(old_hist) >= 5 else 0

                # Threshold 5x — hanya switch jika benar-benar jauh lebih aktif
                if best_var > old_var * 5.0:
                    if new_id == self._candidate_id:
                        self._candidate_frames += 1
                    else:
                        self._candidate_id = new_id
                        self._candidate_frames = 1

                    # Switch hanya jika kandidat sudah bicara cukup lama (consecutive DAN total)
                    total_frames = self._total_speech_frames.get(new_id, 0)
                    fps_estimate = 25  # Estimasi fps
                    total_duration = total_frames / fps_estimate
                    
                    if self._candidate_frames >= self.min_speak_frames and total_duration >= self.min_total_speech_duration:
                        self.active_id = new_id
                        self.cooldown = self.cooldown_frames
                        self._candidate_id = None
                        self._candidate_frames = 0
                else:
                    self._candidate_id = None
                    self._candidate_frames = 0

        for f in faces:
            if f['face_id'] == self.active_id:
                return f

        return best_face or faces[0]


class MouthCenteredFaceTracker:
    """
    Frame-by-frame face tracking pipeline:
    Video → Extract frame → Detect face → Track speaker → Smooth position

    Smoother config:
    - single mode: alpha_fast=0.10, alpha_slow=0.02 — smooth tapi tetap mengikuti
    - grid mode: alpha_fast=0.05, alpha_slow=0.02 — sangat smooth, tidak goyang
    """

    def __init__(self, sample_rate: int = 1):
        self.detector = FaceDetector()
        self.speaker_tracker = SpeakerTracker()
        # Single mode — smooth tapi tetap mengikuti gerakan speaker
        self.smoother = AdaptiveSmoother(alpha_fast=0.10, alpha_slow=0.02, threshold=60)
        # Grid mode — hampir freeze, hanya smooth tracking minimal
        self.grid_speaker_smoother = AdaptiveSmoother(alpha_fast=0.02, alpha_slow=0.01, threshold=100)
        self.grid_listener_smoother = AdaptiveSmoother(alpha_fast=0.02, alpha_slow=0.01, threshold=100)
        self.sample_rate = sample_rate
        self._prev_grid_mode = False
    
    def track_speaking_face(self, video_path: str, start_time: float = None,
                           end_time: float = None) -> List[Dict]:
        """
        Process video frame by frame:
        1. Extract each frame as image
        2. Detect face(s) in image
        3. Identify speaker (if multiple faces)
        4. Record smoothed mouth position
        """
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        start_frame = int(start_time * fps) if start_time else 0
        end_frame = int(end_time * fps) if end_time else total_frames
        
        if start_frame > 0:
            cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
        
        self.smoother.reset()
        self.grid_speaker_smoother.reset()
        self.grid_listener_smoother.reset()
        
        positions = []
        last_position = None
        detected_count = 0
        total_count = 0
        multi_face_count = 0   # Debug: count frames with >=2 faces
        listener_found_count = 0  # Debug: count frames with listener data
        
        print(f"[Tracker] Processing {end_frame - start_frame} frames from {video_path}...")
        
        frame_idx = start_frame
        while frame_idx < end_frame:
            ret, frame = cap.read()
            if not ret:
                break
            
            total_count += 1
            
            if frame_idx % self.sample_rate == 0:
                # Step 1: Detect all faces in this frame/image
                faces = self.detector.detect_all_faces(frame)
                num_faces = len(faces)
                
                # Step 2: Identify speaker
                speaker = self.speaker_tracker.update(faces)
                
                if speaker:
                    # Step 3: Smooth the speaker position
                    # Gunakan grid_speaker_smoother saat multi-face agar tidak goyang
                    raw_pos = speaker['mouth_center']
                    is_multi = num_faces >= 2

                    # Reset smoother saat transisi masuk/keluar grid mode
                    if is_multi != self._prev_grid_mode:
                        self.grid_speaker_smoother.reset()
                        self.grid_listener_smoother.reset()
                        self._prev_grid_mode = is_multi

                    if is_multi:
                        smooth_pos = self.grid_speaker_smoother.update(raw_pos)
                    else:
                        smooth_pos = self.smoother.update(raw_pos)

                    face_box = speaker.get('face_box', None)

                    # Step 4: Find and smooth listener position (if multiple faces)
                    listener_data = None
                    if is_multi:
                        speaker_center = speaker['face_center']
                        best_listener = None
                        best_dist = 0
                        for f in faces:
                            fc = f['face_center']
                            dist = abs(fc[0] - speaker_center[0]) + abs(fc[1] - speaker_center[1])
                            if dist > 50 and dist > best_dist:
                                best_dist = dist
                                best_listener = f

                        if best_listener:
                            listener_smooth = self.grid_listener_smoother.update(best_listener['face_center'])
                            listener_data = {
                                'face_center': listener_smooth,
                                'face_box': best_listener.get('face_box'),
                            }
                            listener_found_count += 1

                        multi_face_count += 1
                        if multi_face_count <= 3:
                            print(f"[Tracker] Frame {frame_idx}: {num_faces} faces detected, "
                                  f"speaker={speaker['face_center']}, "
                                  f"listener={'found at '+str(best_listener['face_center']) if best_listener else 'NOT FOUND'}, "
                                  f"best_dist={best_dist:.0f}")
                    
                    last_position = {
                        'mouth_center': smooth_pos,
                        'face_center': speaker['face_center'],
                        'face_count': num_faces,
                        'face_box': face_box,
                        'listener': listener_data,
                    }
                    detected_count += 1
                    
                    positions.append({
                        "frame": frame_idx,
                        "mouth_center": smooth_pos,
                        "face_center": speaker['face_center'],
                        "face_count": num_faces,
                        "face_box": face_box,
                        "detected": True,
                        "listener": listener_data,
                    })
                else:
                    # No face detected — keep last known position
                    if last_position:
                        positions.append({
                            "frame": frame_idx,
                            "mouth_center": last_position['mouth_center'],
                            "face_center": last_position['face_center'],
                            "face_count": last_position.get('face_count', 1),
                            "listener": last_position.get('listener'),
                            "detected": False,
                        })
                    else:
                        # Very first frame has no face — default to left third
                        fallback = (width // 3, int(height * 0.45))
                        positions.append({
                            "frame": frame_idx,
                            "mouth_center": fallback,
                            "face_center": fallback,
                            "face_count": 0,
                            "listener": None,
                            "detected": False,
                        })
            else:
                # Non-detection frame — use last position
                if last_position:
                    positions.append({
                        "frame": frame_idx,
                        "mouth_center": last_position['mouth_center'],
                        "face_center": last_position['face_center'],
                        "face_count": last_position.get('face_count', 1),
                        "listener": last_position.get('listener'),
                        "detected": False,
                    })
                else:
                    fallback = (width // 3, int(height * 0.45))
                    positions.append({
                        "frame": frame_idx,
                        "mouth_center": fallback,
                        "face_center": fallback,
                        "face_count": 0,
                        "listener": None,
                        "detected": False,
                    })
            
            frame_idx += 1
        
        cap.release()
        
        rate = (detected_count / max(total_count, 1)) * 100
        print(f"[Tracker] ✅ Done: {total_count} frames, "
              f"face detected in {detected_count} ({rate:.0f}%)")
        print(f"[Tracker] 📊 Multi-face frames: {multi_face_count}, "
              f"Listener found: {listener_found_count}")
        
        return positions


class MouthCenteredVideoCropper:
    """
    Frame-by-frame crop pipeline:
    1. Read each frame from video
    2. If >=2 faces: Split into 2-grid (top=listener, bottom=speaker), both zoomed+centered
    3. If 1 face: Normal 9:16 crop centered on face
    4. Debounced transitions — no flickering between modes
    5. Write cropped frame via FFmpeg (HD)
    6. Add audio from original
    """
    
    def __init__(self, mouth_position_ratio: float = 0.45, sample_rate: int = 1):
        """
        Args:
            mouth_position_ratio: Where to put the mouth vertically (0.45 = slightly above center)
            sample_rate: Detect face every N frames (1 = every frame)
        """
        self.tracker = MouthCenteredFaceTracker(sample_rate=sample_rate)
        self.mouth_position_ratio = mouth_position_ratio
    
    def crop_to_aspect_ratio(self, video_path: str, face_positions: List[Dict] = None,
                            output_path: str = None, start_time: float = None,
                            end_time: float = None) -> str:
        """
        Frame-by-frame crop pipeline:
        Video → Frame → Detect Face → Crop 9:16 (single or 2-grid) → HD Output
        """
        # Step 1: Track faces if not provided
        if face_positions is None:
            print("[Crop] Step 1: Tracking speaker positions frame by frame...")
            face_positions = self.tracker.track_speaking_face(video_path, start_time, end_time)
        
        # Step 2: Open video to get fps, then stabilize grid decisions
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")
        fps_for_grid = cap.get(cv2.CAP_PROP_FPS) or 30.0
        cap.release()

        # Stabilize grid mode with fps-aware 3-second threshold
        face_positions = self._stabilize_grid_decisions(face_positions, fps=fps_for_grid)

        # Step 3: Open video for frame extraction
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS)
        orig_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        orig_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        start_frame = int(start_time * fps) if start_time else 0
        end_frame = int(end_time * fps) if end_time else int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        if start_frame > 0:
            cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
        
        # Target 9:16 Full HD
        out_w = 1080
        out_h = 1920
        half_h = out_h // 2  # 960 — each grid cell height
        target_ratio = out_w / out_h  # 0.5625
        grid_ratio = out_w / half_h    # 1.125 — aspect ratio of each grid cell
        
        # Default crop dimensions (full height, for single face)
        if orig_w / orig_h > target_ratio:
            default_crop_h = orig_h
            default_crop_w = int(orig_h * target_ratio)
        else:
            default_crop_w = orig_w
            default_crop_h = int(orig_w / target_ratio)
        
        # Grid cell crop dimensions — zoom into each person's face
        # Use ~50% of original height so face fills the grid cell nicely 
        grid_zoom_factor = 0.50
        grid_crop_h = int(orig_h * grid_zoom_factor)
        grid_crop_w = int(grid_crop_h * grid_ratio)
        # Ensure minimum crop size for quality
        grid_crop_w = max(grid_crop_w, 400)
        grid_crop_h = max(grid_crop_h, int(grid_crop_w / grid_ratio))
        # Ensure crop doesn't exceed original dimensions
        grid_crop_w = min(grid_crop_w, orig_w)
        grid_crop_h = min(grid_crop_h, orig_h)
        
        print(f"[Crop] Source: {orig_w}x{orig_h}")
        print(f"[Crop] 1-face crop: {default_crop_w}x{default_crop_h}")
        print(f"[Crop] 2-face grid cell crop: {grid_crop_w}x{grid_crop_h} (zoom factor: {grid_zoom_factor})")
        print(f"[Crop] Output: {out_w}x{out_h} (grid cell: {out_w}x{half_h})")
        
        if output_path is None:
            output_path = video_path.rsplit('.', 1)[0] + '_cropped.mp4'
        
        # Step 4: Setup FFmpeg for HD output
        stderr_file = tempfile.NamedTemporaryFile(mode='w', suffix='_crop.log', delete=False)
        
        ffmpeg_cmd = [
            'ffmpeg',
            '-f', 'rawvideo', '-pix_fmt', 'bgr24',
            '-s', f'{out_w}x{out_h}', '-r', str(fps),
            '-i', '-',
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
            '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
            '-y', output_path
        ]
        
        proc = subprocess.Popen(
            ffmpeg_cmd, stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL, stderr=stderr_file
        )
        
        # Step 5: Process each frame
        pos_idx = 0
        frames_written = 0
        grid_frame_count = 0
        single_frame_count = 0
        
        print(f"[Crop] Step 2: Cropping {end_frame - start_frame} frames to 9:16 HD...")
        
        try:
            frame_idx = start_frame
            while frame_idx < end_frame:
                ret, frame = cap.read()
                if not ret:
                    break
                
                # Get face position data for this frame
                if pos_idx < len(face_positions):
                    pos_data = face_positions[pos_idx]
                    mouth_pos = pos_data['mouth_center']
                    use_grid = pos_data.get('use_grid', False)
                    listener_data = pos_data.get('listener', None)
                    pos_idx += 1
                else:
                    mouth_pos = (orig_w // 3, int(orig_h * 0.45))
                    use_grid = False
                    listener_data = None
                
                # Decide which frame to produce
                if use_grid and listener_data is not None:
                    resized = self._make_grid_frame(
                        frame, mouth_pos, listener_data,
                        grid_crop_w, grid_crop_h,
                        orig_w, orig_h, out_w, half_h
                    )
                    grid_frame_count += 1
                else:
                    resized = self._make_single_frame(
                        frame, mouth_pos, default_crop_w, default_crop_h,
                        orig_w, orig_h, out_w, out_h
                    )
                    single_frame_count += 1
                
                # Write frame to FFmpeg
                proc.stdin.write(resized.tobytes())
                frames_written += 1
                frame_idx += 1
                
        finally:
            cap.release()
            proc.stdin.close()
            proc.wait()
            stderr_file.close()
        
        # Log any FFmpeg issues
        if proc.returncode != 0:
            try:
                with open(stderr_file.name, 'r') as f:
                    print(f"[Crop] FFmpeg: {f.read()[-300:]}")
            except:
                pass
        
        try:
            os.remove(stderr_file.name)
        except:
            pass
        
        print(f"[Crop] ✅ Cropped {frames_written} frames to HD 1080x1920")
        print(f"[Crop]    Single-mode frames: {single_frame_count}, Grid-mode frames: {grid_frame_count}")
        
        # Step 6: Add audio from original video
        print("[Crop] Step 3: Adding audio...")
        self._add_audio(video_path, output_path, start_time, end_time)
        
        return output_path
    
    def _stabilize_grid_decisions(self, positions: List[Dict], fps: float = 30.0) -> List[Dict]:
        """
        Pre-process face positions to prevent grid mode flickering.

        Rules:
        - Grid MASUK hanya jika 2+ wajah terdeteksi >= 3 detik berturut-turut
        - Grid KELUAR hanya jika kembali ke 1 wajah >= 1.5 detik berturut-turut
        - Threshold dihitung dari fps agar akurat di berbagai video
        """
        ENTER_THRESHOLD = int(fps * 3.0)   # 3 detik — grid tidak muncul untuk bicara pendek
        LEAVE_THRESHOLD = int(fps * 1.5)   # 1.5 detik — tidak langsung hilang saat 1 frame miss

        in_grid_mode = False
        consecutive_multi = 0
        consecutive_single = 0

        for pos in positions:
            face_count = pos.get('face_count', 1)
            has_listener = pos.get('listener') is not None
            wants_grid = (face_count >= 2 and has_listener)

            if wants_grid:
                consecutive_multi += 1
                consecutive_single = 0
            else:
                consecutive_single += 1
                consecutive_multi = 0

            if not in_grid_mode and consecutive_multi >= ENTER_THRESHOLD:
                in_grid_mode = True
                print(f"[Grid] Entering grid mode at frame {pos.get('frame', '?')} "
                      f"(threshold={ENTER_THRESHOLD} frames / {ENTER_THRESHOLD/fps:.1f}s)")
            elif in_grid_mode and consecutive_single >= LEAVE_THRESHOLD:
                in_grid_mode = False
                print(f"[Grid] Leaving grid mode at frame {pos.get('frame', '?')}")

            pos['use_grid'] = in_grid_mode

        grid_count = sum(1 for p in positions if p.get('use_grid'))
        print(f"[Grid] Stabilized: {grid_count}/{len(positions)} frames in grid mode "
              f"({grid_count/max(len(positions),1)*100:.0f}%)")

        return positions
    
    def _make_single_frame(self, frame: np.ndarray, mouth_pos: Tuple[int, int],
                           crop_w: int, crop_h: int,
                           orig_w: int, orig_h: int,
                           out_w: int, out_h: int) -> np.ndarray:
        """Create a single-mode frame: normal 9:16 crop centered on speaker's mouth"""
        x1, y1, x2, y2 = self._crop_box(mouth_pos, crop_w, crop_h, orig_w, orig_h)
        cropped = frame[y1:y2, x1:x2]
        return cv2.resize(cropped, (out_w, out_h), interpolation=cv2.INTER_LINEAR)
    
    def _make_grid_frame(self, frame: np.ndarray, speaker_mouth: Tuple[int, int],
                         listener_data: Dict,
                         crop_w: int, crop_h: int,
                         orig_w: int, orig_h: int,
                         out_w: int, cell_h: int) -> np.ndarray:
        """
        Create a 2-grid frame: top = listener (zoomed+centered), bottom = speaker (zoomed+centered)
        """
        # --- Speaker crop (bottom half) ---
        # Center on speaker's mouth/face with head_ratio positioning
        speaker_crop = self._zoom_crop_face(
            frame, speaker_mouth, crop_w, crop_h, 
            orig_w, orig_h, out_w, cell_h, head_ratio=0.40
        )
        
        # --- Listener crop (top half) ---
        # Center on listener's face center (head centered)
        listener_center = listener_data['face_center']
        listener_crop = self._zoom_crop_face(
            frame, listener_center, crop_w, crop_h,
            orig_w, orig_h, out_w, cell_h, head_ratio=0.45
        )
        
        # Stack vertically: top = listener, bottom = speaker
        grid = np.vstack([listener_crop, speaker_crop])
        
        # Draw a thin separator line between the two halves
        separator_y = cell_h
        cv2.line(grid, (0, separator_y), (out_w, separator_y), (30, 30, 30), 2)
        
        return grid
    
    def _zoom_crop_face(self, frame: np.ndarray, center: Tuple[int, int],
                        crop_w: int, crop_h: int,
                        orig_w: int, orig_h: int,
                        out_w: int, out_h: int,
                        head_ratio: float = 0.45) -> np.ndarray:
        """
        Zoom and crop a region centered on a face position.
        
        Args:
            frame: Original full frame
            center: (x, y) center point to focus on
            crop_w, crop_h: Size of the crop region from the original frame
            orig_w, orig_h: Original frame dimensions
            out_w, out_h: Target output dimensions
            head_ratio: Where to position the head vertically (0.45 = slightly above center)
            
        Returns:
            Cropped and resized frame
        """
        cx, cy = center
        
        # Center horizontally on face
        x1 = cx - crop_w // 2
        
        # Position face at head_ratio from top of crop
        target_y = int(crop_h * head_ratio)
        y1 = cy - target_y
        
        # Clamp to bounds
        x1 = max(0, min(x1, orig_w - crop_w))
        y1 = max(0, min(y1, orig_h - crop_h))
        
        x2 = x1 + crop_w
        y2 = y1 + crop_h
        
        cropped = frame[y1:y2, x1:x2]
        return cv2.resize(cropped, (out_w, out_h), interpolation=cv2.INTER_LINEAR)
    
    def _crop_box(self, mouth: Tuple[int, int], crop_w: int, crop_h: int,
                  vid_w: int, vid_h: int) -> Tuple[int, int, int, int]:
        """Calculate crop box with face/mouth centered"""
        mx, my = mouth
        
        # Center horizontally on mouth
        x1 = mx - crop_w // 2
        
        # Position mouth at mouth_position_ratio from top
        target_y = int(crop_h * self.mouth_position_ratio)
        y1 = my - target_y
        
        # Clamp to bounds
        x1 = max(0, min(x1, vid_w - crop_w))
        y1 = max(0, min(y1, vid_h - crop_h))
        
        return (x1, y1, x1 + crop_w, y1 + crop_h)
    
    def _add_audio(self, source: str, target: str,
                  start_time: float = None, end_time: float = None):
        """Add audio from source video to cropped target"""
        try:
            temp = target.rsplit('.', 1)[0] + '_with_audio.mp4'
            
            cmd = ['ffmpeg', '-i', target]
            if start_time is not None:
                cmd.extend(['-ss', str(start_time)])
            if end_time is not None and start_time is not None:
                cmd.extend(['-t', str(end_time - start_time)])
            
            cmd.extend([
                '-i', source,
                '-map', '0:v:0', '-map', '1:a:0',
                '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
                '-shortest', '-y', temp
            ])
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                os.replace(temp, target)
                print("[Crop] ✅ Audio added")
            else:
                print(f"[Crop] FFmpeg audio error: {result.stderr[:200]}")
                self._add_audio_fallback(source, target, start_time, end_time)
        except Exception as e:
            print(f"[Crop] Audio error: {e}")
            self._add_audio_fallback(source, target, start_time, end_time)
    
    def _add_audio_fallback(self, source: str, target: str,
                            start_time: float = None, end_time: float = None):
        """MoviePy fallback for audio"""
        from moviepy import VideoFileClip
        src = tgt = final = None
        try:
            src = VideoFileClip(source)
            if src.audio:
                audio = src.subclipped(start_time, end_time).audio if start_time and end_time else src.audio
                tgt = VideoFileClip(target)
                final = tgt.with_audio(audio)
                tmp = target.rsplit('.', 1)[0] + '_tmp.mp4'
                final.write_videofile(tmp, codec='libx264', audio_codec='aac',
                                      bitrate='8000k', logger=None)
                os.replace(tmp, target)
        except Exception as e:
            print(f"[Crop] MoviePy audio also failed: {e}")
        finally:
            for v in [final, tgt, src]:
                if v: v.close()
