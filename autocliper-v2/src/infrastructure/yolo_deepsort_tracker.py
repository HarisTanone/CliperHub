"""
Advanced Video Processing Pipeline v2
======================================
YOLOv8s + ByteTrack + OpenCV DNN + Kalman Filter

Architecture:
    PersonDetector → ByteTrack → FaceDetector → HeadPositioner
    → KalmanSmoother → SpeakerDetector → LayoutManager
    → SmartCropper → TransitionBlender → HD Output

Key features:
    - ByteTrack tracking (built into ultralytics) for stable person IDs
    - Kalman filter smoothing for jitter-free crop movement
    - Speaker detection via face-area variance → always at BOTTOM grid
    - Per-person bbox cropping → guaranteed different people in each cell
    - Crossfade transitions between single ↔ grid modes
    - ID→position mapping persists across frames
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

# ---------------------------------------------------------------------------
#  Lazy model loading
# ---------------------------------------------------------------------------
_yolo_model = None
_dnn_net = None


def _get_yolo_model(model_size: str = 'yolov8s.pt'):
    global _yolo_model
    if _yolo_model is None:
        from ultralytics import YOLO
        _yolo_model = YOLO(model_size)
        # Check for MPS (Apple Silicon)
        import torch
        if torch.backends.mps.is_available():
            print(f"[YOLO] ✅ {model_size} loaded (MPS acceleration)")
        else:
            print(f"[YOLO] ✅ {model_size} loaded (CPU)")
    return _yolo_model


def _get_dnn_net():
    global _dnn_net
    if _dnn_net is not None:
        return _dnn_net
    try:
        import urllib.request
        models_dir = os.path.join(os.path.dirname(__file__), 'models')
        prototxt = os.path.join(models_dir, 'deploy.prototxt')
        caffemodel = os.path.join(models_dir, 'res10_300x300_ssd_iter_140000.caffemodel')

        if not os.path.exists(prototxt) or not os.path.exists(caffemodel):
            os.makedirs(models_dir, exist_ok=True)
            if not os.path.exists(prototxt):
                print("[FaceDetect] Downloading deploy.prototxt...")
                urllib.request.urlretrieve(
                    "https://raw.githubusercontent.com/opencv/opencv/master/samples/dnn/face_detector/deploy.prototxt",
                    prototxt)
            if not os.path.exists(caffemodel):
                print("[FaceDetect] Downloading caffemodel (10MB)...")
                urllib.request.urlretrieve(
                    "https://raw.githubusercontent.com/opencv/opencv_3rdparty/dnn_samples_face_detector_20170830/res10_300x300_ssd_iter_140000.caffemodel",
                    caffemodel)
        _dnn_net = cv2.dnn.readNetFromCaffe(prototxt, caffemodel)
        print("[FaceDetect] ✅ OpenCV DNN face detector loaded")
    except Exception as e:
        print(f"[FaceDetect] ⚠️ DNN init failed: {e}")
    return _dnn_net


# ═══════════════════════════════════════════════════════════════════════════
#  1. PERSON DETECTOR + BYTETRACK
# ═══════════════════════════════════════════════════════════════════════════
class PersonDetector:
    """
    YOLOv8s person detection with built-in ByteTrack tracking.
    Uses model.track() for persistent ID assignment.
    """

    def __init__(self, confidence: float = 0.40, model_size: str = 'yolov8s.pt'):
        self.model = _get_yolo_model(model_size)
        self.confidence = confidence
        # Use custom ByteTrack config for stable tracking
        self._tracker_config = os.path.join(
            os.path.dirname(__file__), 'custom_bytetrack.yaml'
        )
        if not os.path.exists(self._tracker_config):
            self._tracker_config = 'bytetrack.yaml'  # fallback to default

    def detect_and_track(self, frame: np.ndarray) -> List[Dict]:
        """
        Detect + track persons in a single call using ByteTrack.
        Returns list of {track_id, bbox, confidence}.
        """
        results = self.model.track(
            frame,
            classes=[0],           # person only
            conf=self.confidence,
            persist=True,          # maintain tracks across frames
            tracker=self._tracker_config,
            verbose=False
        )

        persons = []
        for r in results:
            if r.boxes is None or r.boxes.id is None:
                continue
            for i, box in enumerate(r.boxes):
                if box.id is None:
                    continue
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                track_id = int(box.id[0].cpu().numpy())
                conf = float(box.conf[0].cpu().numpy())
                w, h = x2 - x1, y2 - y1
                if w > 40 and h > 60:
                    persons.append({
                        'track_id': track_id,
                        'bbox': (int(x1), int(y1), int(x2), int(y2)),
                        'confidence': conf,
                    })
        return persons

    def detect_only(self, frame: np.ndarray) -> List[Dict]:
        """Detection without tracking (for single frames)."""
        results = self.model(frame, classes=[0], conf=self.confidence, verbose=False)
        persons = []
        for r in results:
            if r.boxes is None:
                continue
            for box in r.boxes:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                conf = float(box.conf[0].cpu().numpy())
                w, h = x2 - x1, y2 - y1
                if w > 40 and h > 60:
                    persons.append({
                        'bbox': (int(x1), int(y1), int(x2), int(y2)),
                        'confidence': conf,
                    })
        return persons


# ═══════════════════════════════════════════════════════════════════════════
#  2. FACE DETECTOR — OpenCV DNN in person bounding box
# ═══════════════════════════════════════════════════════════════════════════
# Lazy MediaPipe Face Mesh for mouth landmark
_mp_face_mesh = None

def _get_face_mesh():
    global _mp_face_mesh
    if _mp_face_mesh is None:
        import contextlib
        import mediapipe as mp
        with open(os.devnull, 'w') as devnull:
            with contextlib.redirect_stderr(devnull):
                _mp_face_mesh = mp.solutions.face_mesh.FaceMesh(
                    static_image_mode=False,
                    max_num_faces=4,
                    refine_landmarks=True,
                    min_detection_confidence=0.3,
                    min_tracking_confidence=0.3,
                )
    return _mp_face_mesh


def _get_mouth_open(frame: np.ndarray, face_box: Tuple[int, int, int, int]) -> float:
    """
    Measure mouth openness (0-100) using MediaPipe Face Mesh.
    Uses inner lip landmarks: upper(13) and lower(14).
    Returns 0.0 if detection fails.
    """
    try:
        mesh = _get_face_mesh()
        fx, fy, fw, fh = face_box
        h, w = frame.shape[:2]

        # Expand crop slightly for better landmark detection
        pad = int(max(fw, fh) * 0.3)
        x1 = max(0, fx - pad)
        y1 = max(0, fy - pad)
        x2 = min(w, fx + fw + pad)
        y2 = min(h, fy + fh + pad)

        crop = frame[y1:y2, x1:x2]
        if crop.size == 0:
            return 0.0

        import cv2 as _cv2
        rgb = _cv2.cvtColor(crop, _cv2.COLOR_BGR2RGB)
        result = mesh.process(rgb)

        if not result.multi_face_landmarks:
            return 0.0

        lm = result.multi_face_landmarks[0].landmark
        ch, cw = crop.shape[:2]

        # Inner lip: upper=13, lower=14
        upper_y = lm[13].y * ch
        lower_y = lm[14].y * ch
        mouth_gap = abs(lower_y - upper_y)

        # Normalize by face height
        forehead_y = lm[10].y * ch
        chin_y = lm[152].y * ch
        face_h = max(abs(chin_y - forehead_y), 1)

        return float(mouth_gap / face_h * 100)
    except Exception:
        return 0.0


class FaceDetector:
    """Detect face within a person's bounding box using OpenCV DNN + mouth landmark."""

    def __init__(self, min_confidence: float = 0.35):
        self.min_confidence = min_confidence

    def detect_in_person(self, frame: np.ndarray,
                         person_bbox: Tuple[int, int, int, int]) -> Optional[Dict]:
        """
        Detect face inside person bbox.
        Returns: {face_center, face_box, face_area, estimated}
        """
        net = _get_dnn_net()
        x1, y1, x2, y2 = person_bbox
        h_frame, w_frame = frame.shape[:2]

        if net is None:
            return self._estimate_from_bbox(x1, y1, x2, y2)

        # Clamp
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w_frame, x2), min(h_frame, y2)

        # Crop upper body (face in top 65%)
        upper_y2 = y1 + int((y2 - y1) * 0.65)
        pad_x = int((x2 - x1) * 0.15)
        cx1, cx2 = max(0, x1 - pad_x), min(w_frame, x2 + pad_x)

        crop = frame[y1:upper_y2, cx1:cx2]
        if crop.size == 0:
            return None

        crop_h, crop_w = crop.shape[:2]

        try:
            blob = cv2.dnn.blobFromImage(crop, 1.0, (300, 300),
                                         (104.0, 177.0, 123.0), swapRB=False, crop=False)
            net.setInput(blob)
            detections = net.forward()

            best_face, best_conf = None, self.min_confidence
            for i in range(detections.shape[2]):
                conf = detections[0, 0, i, 2]
                if conf > best_conf:
                    box = detections[0, 0, i, 3:7] * np.array([crop_w, crop_h, crop_w, crop_h])
                    fx1, fy1, fx2, fy2 = box.astype(int)
                    fw, fh = fx2 - fx1, fy2 - fy1
                    if fw > 20 and fh > 20:
                        best_face = (fx1, fy1, fw, fh)
                        best_conf = conf

            if best_face:
                fx1, fy1, fw, fh = best_face
                abs_x1 = fx1 + cx1
                abs_y1 = fy1 + y1
                face_box = (abs_x1, abs_y1, fw, fh)
                mouth_open = _get_mouth_open(frame, face_box)
                return {
                    'face_center': (abs_x1 + fw // 2, abs_y1 + fh // 2),
                    'face_box': face_box,
                    'face_area': fw * fh,
                    'mouth_open': mouth_open,
                    'estimated': False,
                }
        except Exception:
            pass

        return self._estimate_from_bbox(x1, y1, x2, y2)

    @staticmethod
    def _estimate_from_bbox(x1, y1, x2, y2) -> Dict:
        """Fallback: estimate face from person bbox upper quarter."""
        cx = (x1 + x2) // 2
        cy = y1 + (y2 - y1) // 4
        pw, ph = x2 - x1, (y2 - y1) // 2
        return {
            'face_center': (cx, cy),
            'face_box': (x1, y1, pw, ph),
            'face_area': pw * ph,
            'mouth_open': 0.0,
            'estimated': True,
        }


# ═══════════════════════════════════════════════════════════════════════════
#  3. HEAD POSITIONER — rule-of-thirds from face bbox geometry
# ═══════════════════════════════════════════════════════════════════════════
class HeadPositioner:
    """
    Calculate ideal head center for cropping using rule-of-thirds.
    Eyes should be at ~1/3 from top of the crop frame.
    Estimated from face bbox: eyes ≈ 35% from top of face box.
    """

    @staticmethod
    def get_head_target(face_box: Tuple[int, int, int, int],
                        face_center: Tuple[int, int]) -> Tuple[int, int]:
        """
        Returns the target point that should be placed at 1/3 from top.
        This is the estimated eye line position.
        """
        fx, fy, fw, fh = face_box
        # Eye line ≈ 35% from top of face bounding box
        eye_y = fy + int(fh * 0.35)
        # Horizontal center of face
        eye_x = face_center[0]
        return (eye_x, eye_y)

    @staticmethod
    def calculate_headroom(face_box: Tuple[int, int, int, int],
                           crop_h: int) -> float:
        """
        Calculate the ratio at which the head target should be placed
        from the top of the crop area. Uses rule of thirds.
        Returns ratio (0.0 = top, 1.0 = bottom).
        """
        _, _, _, fh = face_box
        # For close-up faces, place higher (0.30)
        # For distant faces, place slightly lower (0.38)
        face_size_ratio = fh / max(crop_h, 1)
        if face_size_ratio > 0.3:
            return 0.30  # close up — more headroom
        elif face_size_ratio > 0.15:
            return 0.33  # medium — rule of thirds
        else:
            return 0.38  # far away — less aggressive


# ═══════════════════════════════════════════════════════════════════════════
#  4. KALMAN SMOOTHER — per-track position + velocity smoothing
# ═══════════════════════════════════════════════════════════════════════════
class KalmanSmoother:
    """
    Kalman filter for 2D position smoothing with velocity estimation.
    State: [x, y, vx, vy]
    Measurement: [x, y]
    Tuned for very stable, low-jitter output: high measurement_noise,
    low process_noise → trusts filter prediction more than raw detection.
    """

    def __init__(self, process_noise: float = 0.08, measurement_noise: float = 25.0):
        # State: [x, y, vx, vy]
        self.state = np.zeros(4, dtype=np.float64)
        # State covariance
        self.P = np.eye(4, dtype=np.float64) * 500.0
        # State transition (constant velocity model)
        self.F = np.array([
            [1, 0, 1, 0],
            [0, 1, 0, 1],
            [0, 0, 1, 0],
            [0, 0, 0, 1],
        ], dtype=np.float64)
        # Measurement matrix
        self.H = np.array([
            [1, 0, 0, 0],
            [0, 1, 0, 0],
        ], dtype=np.float64)
        # Process noise — very low: minimal velocity drift between frames
        self.Q = np.eye(4, dtype=np.float64) * process_noise
        self.Q[2, 2] = process_noise * 0.2  # velocity noise much lower
        self.Q[3, 3] = process_noise * 0.2
        # Measurement noise — high: trust smoothed prediction > raw detection
        self.R = np.eye(2, dtype=np.float64) * measurement_noise

        self._initialized = False

    def update(self, measurement: Tuple[int, int]) -> Tuple[int, int]:
        """Update filter with new measurement, return smoothed position."""
        z = np.array([measurement[0], measurement[1]], dtype=np.float64)

        if not self._initialized:
            self.state[0] = z[0]
            self.state[1] = z[1]
            self.state[2] = 0.0
            self.state[3] = 0.0
            self._initialized = True
            return (int(z[0]), int(z[1]))

        # Predict
        state_pred = self.F @ self.state
        P_pred = self.F @ self.P @ self.F.T + self.Q

        # Update
        y = z - self.H @ state_pred
        S = self.H @ P_pred @ self.H.T + self.R
        K = P_pred @ self.H.T @ np.linalg.inv(S)

        self.state = state_pred + K @ y
        self.P = (np.eye(4) - K @ self.H) @ P_pred

        return (int(self.state[0]), int(self.state[1]))

    def predict(self) -> Tuple[int, int]:
        """Predict next position without measurement (for missing frames)."""
        if not self._initialized:
            return (0, 0)
        state_pred = self.F @ self.state
        return (int(state_pred[0]), int(state_pred[1]))

    def reset(self, process_noise: float = 1.0, measurement_noise: float = 5.0):
        self.__init__(process_noise, measurement_noise)


class BBoxSmoother:
    """Smooth bounding box coordinates using EMA.
    Lower alpha = slower response = smoother, less jittery movement.
    """

    def __init__(self, alpha: float = 0.05):
        self.alpha = alpha
        self._smooth_bbox = None

    def update(self, bbox: Tuple[int, int, int, int]) -> Tuple[int, int, int, int]:
        if self._smooth_bbox is None:
            self._smooth_bbox = np.array(bbox, dtype=np.float64)
        else:
            target = np.array(bbox, dtype=np.float64)
            self._smooth_bbox += self.alpha * (target - self._smooth_bbox)
        return tuple(int(v) for v in self._smooth_bbox)


# ═══════════════════════════════════════════════════════════════════════════
#  5. SPEAKER DETECTOR — face-area variance analysis
# ═══════════════════════════════════════════════════════════════════════════
class SpeakerDetector:
    """
    Detect active speaker using mouth-openness variance (MediaPipe landmark).
    mouth_open = jarak bibir atas-bawah / tinggi wajah × 100

    Lebih akurat dari face_area karena:
    - Mengangguk / menoleh tidak membuka mulut → tidak dianggap bicara
    - Hanya gerakan mulut yang dihitung

    Lock lebih ketat:
    - lock_frames=150 (~5s di 30fps) — tidak gampang pindah
    - min_switch_ratio=2.0 — kandidat harus 2x lebih aktif mulutnya
    """

    def __init__(self, window_size: int = 60, lock_frames: int = 150):
        self.window_size = window_size
        self.lock_frames = lock_frames
        self.min_switch_ratio = 2.0  # kandidat harus 2x lebih aktif
        self._histories: Dict[int, deque] = {}  # mouth_open history per track
        self._speaker_id: Optional[int] = None
        self._lock_counter: int = 0

    def update(self, persons: List[Dict]) -> Optional[int]:
        """Update with current frame persons. Returns speaker track_id."""
        if not persons:
            return self._speaker_id

        current_ids = set()
        for p in persons:
            tid = p['track_id']
            current_ids.add(tid)
            mouth_open = p.get('mouth_open', 0.0)
            if tid not in self._histories:
                self._histories[tid] = deque(maxlen=self.window_size)
            self._histories[tid].append(mouth_open)

        # Purge old tracks
        for old_id in list(self._histories.keys()):
            if old_id not in current_ids:
                del self._histories[old_id]

        # Single person = speaker
        if len(persons) == 1:
            self._speaker_id = persons[0]['track_id']
            self._lock_counter = 0
            return self._speaker_id

        # Hold lock while counter < lock_frames
        if self._speaker_id in current_ids:
            self._lock_counter += 1
            if self._lock_counter < self.lock_frames:
                return self._speaker_id

        # Re-evaluate: mouth variance per track
        variances = {}
        for tid, history in self._histories.items():
            if tid not in current_ids or len(history) < 15:
                continue
            variances[tid] = float(np.std(list(history)))

        if not variances:
            return self._speaker_id

        best_id = max(variances, key=variances.get)
        best_var = variances[best_id]
        current_var = variances.get(self._speaker_id, 0)

        should_switch = (
            best_id != self._speaker_id and
            (current_var == 0 or best_var > current_var * self.min_switch_ratio)
        )

        if should_switch:
            print(f"[Speaker] 🎤 Switch: track {self._speaker_id} → {best_id} "
                  f"(mouth σ={best_var:.2f} vs {current_var:.2f})")
            self._speaker_id = best_id
            self._lock_counter = 0
        else:
            self._lock_counter = 0

        return self._speaker_id


# ═══════════════════════════════════════════════════════════════════════════
#  6. LAYOUT MANAGER — grid decisions + ID→position mapping
# ═══════════════════════════════════════════════════════════════════════════
class LayoutManager:
    """
    Manages layout mode (single vs grid) with debounced transitions.
    Uses SPATIAL POSITION LOCKING — once a person is assigned to
    top or bottom, they STAY there for the entire grid session.

    Rules:
        - 1 person  → SINGLE mode
        - 2+ persons → GRID mode (after ENTER_THRESHOLD consecutive frames)
        - Exit grid only after LEAVE_THRESHOLD frames of <2 persons
        - ID→slot mapping is FROZEN once assigned (spatial locking)
        - Mapping resets only when grid mode exits completely
    """

    LEAVE_THRESHOLD = 25   # frames of <2 to leave grid (slightly longer)
    ID_PERSIST_FRAMES = 60 # keep mapping alive longer after track lost

    def __init__(self, fps: float = 30.0):
        # Enter grid only if 2+ persons visible for >3 seconds (fps-aware)
        self.ENTER_THRESHOLD = int(fps * 3.0)
        self.in_grid_mode = False
        self._consec_multi = 0
        self._consec_single = 0
        # ID → last-seen frame index
        self._id_last_seen: Dict[int, int] = {}
        # SPATIAL LOCKING: ID → slot ('top' or 'bottom')
        # Once assigned, NEVER changes during a grid session
        self._id_to_slot: Dict[int, str] = {}
        # Frozen grid crop — set once when entering grid, reused every frame
        self.frozen_top_person: Optional[Dict] = None
        self.frozen_bottom_person: Optional[Dict] = None
        self._grid_just_entered: bool = False

    def update(self, person_count: int, frame_idx: int,
               person_ids: List[int]) -> bool:
        """
        Update layout state. Returns True if grid mode active.
        """
        wants_grid = person_count >= 2

        if wants_grid:
            self._consec_multi += 1
            self._consec_single = 0
        else:
            self._consec_single += 1
            self._consec_multi = 0

        # State transitions
        if not self.in_grid_mode and self._consec_multi >= self.ENTER_THRESHOLD:
            self.in_grid_mode = True
            self._grid_just_entered = True  # signal: freeze crop on this frame
            print(f"[Layout] 🟢 → GRID mode at frame {frame_idx} "
                  f"(threshold={self.ENTER_THRESHOLD} frames)")
        elif self.in_grid_mode and self._consec_single >= self.LEAVE_THRESHOLD:
            self.in_grid_mode = False
            self._grid_just_entered = False
            # Reset slot assignments and frozen crop when exiting grid
            self._id_to_slot.clear()
            self.frozen_top_person = None
            self.frozen_bottom_person = None
            print(f"[Layout] 🔴 → SINGLE mode at frame {frame_idx}")

        # Update last-seen for all current IDs
        for tid in person_ids:
            self._id_last_seen[tid] = frame_idx

        # Purge old IDs
        for tid in list(self._id_last_seen.keys()):
            if frame_idx - self._id_last_seen[tid] > self.ID_PERSIST_FRAMES:
                del self._id_last_seen[tid]
                # Also remove slot assignment for purged IDs
                self._id_to_slot.pop(tid, None)

        return self.in_grid_mode

    def get_top_bottom(self, persons: List[Dict],
                       speaker_id: Optional[int]) -> Tuple[Dict, Dict]:
        """
        Returns (top_person, bottom_person) for grid mode.
        Uses SPATIAL LOCKING:
        - First time: speaker gets bottom, other gets top.
        - After assignment: positions NEVER change, regardless of speaker.
        - New track IDs inherit available slot.
        """
        if len(persons) < 2:
            return persons[0], persons[0]

        current_ids = [p['track_id'] for p in persons]
        person_by_id = {p['track_id']: p for p in persons}

        # Assign slots for any new IDs
        for p in persons:
            tid = p['track_id']
            if tid not in self._id_to_slot:
                # Check which slots are taken
                taken_slots = set(self._id_to_slot.values())

                if 'bottom' not in taken_slots:
                    # First assignment: speaker gets bottom
                    if tid == speaker_id:
                        self._id_to_slot[tid] = 'bottom'
                    elif 'top' not in taken_slots:
                        self._id_to_slot[tid] = 'top'
                    else:
                        self._id_to_slot[tid] = 'bottom'
                elif 'top' not in taken_slots:
                    self._id_to_slot[tid] = 'top'
                else:
                    # Both slots taken — use spatial Y position to decide
                    # Person closer to top of frame → top slot
                    existing_bottom = None
                    for eid, slot in self._id_to_slot.items():
                        if slot == 'bottom' and eid in current_ids:
                            existing_bottom = eid
                    if existing_bottom and p.get('bbox'):
                        _, py1, _, _ = p['bbox']
                        _, eby1, _, _ = person_by_id.get(existing_bottom, {}).get('bbox', (0,0,0,0))
                        self._id_to_slot[tid] = 'top' if py1 < eby1 else 'bottom'
                    else:
                        self._id_to_slot[tid] = 'top'

                print(f"[Layout] 📌 Track {tid} → {self._id_to_slot[tid]} (locked)")

        # Get persons by slot
        top_person = None
        bottom_person = None

        for p in persons:
            slot = self._id_to_slot.get(p['track_id'])
            if slot == 'top' and top_person is None:
                top_person = p
            elif slot == 'bottom' and bottom_person is None:
                bottom_person = p

        # Fallback if slot mapping doesn't cover all
        if top_person is None:
            top_person = persons[0] if persons[0] != bottom_person else persons[1]
        if bottom_person is None:
            bottom_person = persons[1] if persons[1] != top_person else persons[0]

        return top_person, bottom_person


# ═══════════════════════════════════════════════════════════════════════════
#  7. SMART CROPPER — bbox-based with dynamic padding
# ═══════════════════════════════════════════════════════════════════════════
class SmartCropper:
    """
    Crop frames with person-aware centering.
    - Single mode: full 9:16 crop centered on face
    - Grid mode:  per-person bbox crop with shoulder padding
    """

    def __init__(self, head_positioner: HeadPositioner):
        self.head = head_positioner
        # Per-track smoothers for grid crop position + size (eliminate jitter)
        self._grid_pos_smoothers: Dict[int, 'BBoxSmoother'] = {}   # (x1, y1)
        self._grid_size_smoothers: Dict[int, 'BBoxSmoother'] = {}  # (crop_w,)

    def _get_grid_pos_smoother(self, tid: int) -> 'BBoxSmoother':
        if tid not in self._grid_pos_smoothers:
            # alpha=0.04: very slow response → minimal position drift in grid
            self._grid_pos_smoothers[tid] = BBoxSmoother(alpha=0.04)
        return self._grid_pos_smoothers[tid]

    def _get_grid_size_smoother(self, tid: int) -> 'BBoxSmoother':
        if tid not in self._grid_size_smoothers:
            # alpha=0.02: extremely slow → effectively freezes crop size
            self._grid_size_smoothers[tid] = BBoxSmoother(alpha=0.02)
        return self._grid_size_smoothers[tid]

    # Track which grid tracks have had their size "locked in"
    _grid_size_locked: Dict[int, int] = {}
    GRID_SIZE_LOCK_FRAMES = 15  # frames before locking size

    def reset_grid_smoothers(self):
        """Call when leaving grid mode to reset state."""
        self._grid_pos_smoothers.clear()
        self._grid_size_smoothers.clear()

    def crop_single(self, frame: np.ndarray,
                    face_center: Tuple[int, int],
                    face_box: Tuple[int, int, int, int],
                    crop_w: int, crop_h: int,
                    orig_w: int, orig_h: int,
                    out_w: int, out_h: int) -> np.ndarray:
        """Full-frame 9:16 crop with head at rule-of-thirds."""
        head_target = self.head.get_head_target(face_box, face_center)
        headroom = self.head.calculate_headroom(face_box, crop_h)

        cx, cy = head_target
        x1 = cx - crop_w // 2
        target_y = int(crop_h * headroom)
        y1 = cy - target_y

        x1 = max(0, min(x1, orig_w - crop_w))
        y1 = max(0, min(y1, orig_h - crop_h))

        cropped = frame[y1:y1 + crop_h, x1:x1 + crop_w]
        return cv2.resize(cropped, (out_w, out_h), interpolation=cv2.INTER_LINEAR)

    def crop_person_cell(self, frame: np.ndarray, person: Dict,
                         grid_ratio: float, orig_w: int, orig_h: int,
                         out_w: int, cell_h: int,
                         headroom: float = 0.35,
                         track_id: int = -1) -> np.ndarray:
        """
        Crop a grid cell from a specific person's bounding box area.
        Dynamic padding based on person width (shoulder estimation).
        Crop position and size are smoothed per-track to eliminate jitter.
        """
        bbox = person.get('bbox')
        face_center = person['face_center']
        face_box = person.get('face_box', (0, 0, 100, 100))
        cx, cy = face_center

        if bbox:
            bx1, by1, bx2, by2 = bbox
            person_w = bx2 - bx1
            person_h = by2 - by1
            person_cx = (bx1 + bx2) // 2

            # Dynamic padding: wider for smaller persons (more context)
            size_ratio = person_w / max(orig_w, 1)
            if size_ratio < 0.2:
                pad_factor = 1.5  # small person, show more context
            elif size_ratio < 0.4:
                pad_factor = 1.3  # medium
            else:
                pad_factor = 1.15  # large, minimal padding

            # Raw crop size
            raw_crop_w = max(int(person_w * pad_factor), 300)
            raw_crop_h = int(raw_crop_w / grid_ratio)
            raw_crop_h = max(raw_crop_h, int(person_h * 0.75))
            raw_crop_w = int(raw_crop_h * grid_ratio)

            # Ensure minimum crop size (at least 40% of frame height)
            min_crop_h = int(orig_h * 0.40)
            if raw_crop_h < min_crop_h:
                raw_crop_h = min_crop_h
                raw_crop_w = int(raw_crop_h * grid_ratio)

            # ── Smooth crop SIZE to eliminate zoom jitter ──
            if track_id >= 0:
                smoothed_size = self._get_grid_size_smoother(track_id).update(
                    (raw_crop_w, raw_crop_w, raw_crop_w, raw_crop_w)  # 4-tuple for BBoxSmoother
                )
                crop_w = int(smoothed_size[0])
            else:
                crop_w = raw_crop_w
            crop_h = int(crop_w / grid_ratio)
            crop_h = max(crop_h, int(person_h * 0.55))
            crop_w = int(crop_h * grid_ratio)

            # Clamp to frame
            crop_w = min(crop_w, orig_w)
            crop_h = min(crop_h, orig_h)

            # Get head target
            head_target = self.head.get_head_target(face_box, face_center)
            head_x, head_y = head_target

            # Raw position: center on person horizontally, head at headroom ratio
            raw_x1 = person_cx - crop_w // 2
            target_y_off = int(crop_h * headroom)
            raw_y1 = head_y - target_y_off
        else:
            crop_h = int(orig_h * 0.5)
            crop_w = int(crop_h * grid_ratio)
            crop_w = min(crop_w, orig_w)
            crop_h = min(crop_h, orig_h)
            raw_x1 = cx - crop_w // 2
            target_y_off = int(crop_h * headroom)
            raw_y1 = cy - target_y_off

        # ── Smooth crop POSITION to eliminate jitter ──
        if track_id >= 0:
            smoothed_pos = self._get_grid_pos_smoother(track_id).update(
                (raw_x1, raw_y1, raw_x1, raw_y1)  # 4-tuple for BBoxSmoother
            )
            x1 = int(smoothed_pos[0])
            y1 = int(smoothed_pos[1])
        else:
            x1 = raw_x1
            y1 = raw_y1

        # Clamp
        x1 = max(0, min(x1, orig_w - crop_w))
        y1 = max(0, min(y1, orig_h - crop_h))

        cropped = frame[y1:y1 + crop_h, x1:x1 + crop_w]
        return cv2.resize(cropped, (out_w, cell_h), interpolation=cv2.INTER_LINEAR)



# ═══════════════════════════════════════════════════════════════════════════
#  8. TRANSITION BLENDER — crossfade + ease between modes
# ═══════════════════════════════════════════════════════════════════════════
class TransitionBlender:
    """
    Smooth transitions between layout modes.
    - single → grid: INSTANT CUT (no crossfade) so grid appears immediately
    - grid → single: gentle crossfade with cubic ease-in-out
    This avoids the slow zoom-in effect when entering grid.
    """

    def __init__(self, crossfade_frames: int = 10):
        self.crossfade_frames = crossfade_frames  # only used for grid→single
        self._prev_mode: str = 'single'
        self._transition_frame: int = -9999
        self._frozen_frame: Optional[np.ndarray] = None  # frozen pre-transition
        self._last_render: Optional[np.ndarray] = None    # last output for tracking
        self._transition_type: str = ''  # 'enter_grid' or 'exit_grid'

    @staticmethod
    def _ease(t: float) -> float:
        """Cubic ease-in-out: smooth acceleration + deceleration."""
        t = max(0.0, min(1.0, t))
        if t < 0.5:
            return 4 * t * t * t
        else:
            return 1 - pow(-2 * t + 2, 3) / 2

    def blend(self, current_mode: str, frame_idx: int,
              current_render: np.ndarray,
              alternate_render: Optional[np.ndarray] = None) -> np.ndarray:
        """
        Blend between modes during transition.
        single → grid: INSTANT CUT (grid shows immediately, no slow zoom)
        grid → single: smooth crossfade so exit is not jarring
        """
        # Detect mode change
        if current_mode != self._prev_mode:
            self._transition_frame = frame_idx
            if current_mode == 'grid':
                # Entering grid: instant cut — do NOT freeze or crossfade
                self._transition_type = 'enter_grid'
                self._frozen_frame = None
            else:
                # Exiting grid: smooth crossfade
                self._transition_type = 'exit_grid'
                if self._last_render is not None:
                    self._frozen_frame = self._last_render.copy()
            self._prev_mode = current_mode

        # Only crossfade on grid → single exit
        frames_since = frame_idx - self._transition_frame
        in_transition = (
            self._transition_type == 'exit_grid' and
            frames_since < self.crossfade_frames and
            self._frozen_frame is not None
        )

        if in_transition:
            t = frames_since / self.crossfade_frames
            alpha = self._ease(t)
            if self._frozen_frame.shape == current_render.shape:
                result = cv2.addWeighted(
                    self._frozen_frame, 1.0 - alpha,
                    current_render, alpha, 0
                )
            else:
                result = current_render
        else:
            result = current_render
            if frames_since >= self.crossfade_frames:
                self._frozen_frame = None

        # Always track the latest render for future freeze
        self._last_render = current_render.copy()
        return result


# ═══════════════════════════════════════════════════════════════════════════
#  9. MAIN TRACKER — frame-by-frame processing
# ═══════════════════════════════════════════════════════════════════════════
class FrameTracker:
    """
    Combines all components for frame-by-frame person tracking.
    PersonDetector → FaceDetector → KalmanSmoother → SpeakerDetector
    """

    def __init__(self, sample_rate: int = 1):
        self.person_detector = PersonDetector()
        self.face_detector = FaceDetector()
        self.speaker_detector = SpeakerDetector()
        self.sample_rate = sample_rate
        # Per-track smoothers
        self._face_smoothers: Dict[int, KalmanSmoother] = {}
        self._bbox_smoothers: Dict[int, BBoxSmoother] = {}

    def _get_face_smoother(self, tid: int) -> KalmanSmoother:
        if tid not in self._face_smoothers:
            self._face_smoothers[tid] = KalmanSmoother(
                process_noise=0.05,     # very low → almost no drift between frames
                measurement_noise=30.0  # very high → trust filter over raw detection
            )
        return self._face_smoothers[tid]

    def _get_bbox_smoother(self, tid: int) -> BBoxSmoother:
        if tid not in self._bbox_smoothers:
            self._bbox_smoothers[tid] = BBoxSmoother(alpha=0.03)  # ultra-slow EMA
        return self._bbox_smoothers[tid]

    def track_video(self, video_path: str,
                    start_time: float = None,
                    end_time: float = None) -> List[Dict]:
        """
        Process entire video. Returns per-frame tracking data.
        """
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        start_frame = int(start_time * fps) if start_time else 0
        end_frame = int(end_time * fps) if end_time else total_frames

        if start_frame > 0:
            cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

        positions = []
        last_pos = None
        det_count = 0

        n_frames = end_frame - start_frame
        print(f"[Tracker] Processing {n_frames} frames "
              f"(sample_rate={self.sample_rate})...")

        frame_idx = start_frame
        while frame_idx < end_frame:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % self.sample_rate == 0:
                # Detect + track
                raw_persons = self.person_detector.detect_and_track(frame)

                # Face detection + smoothing for each person
                processed = []
                for rp in raw_persons:
                    tid = rp['track_id']
                    bbox = rp['bbox']

                    # Smooth bbox
                    smooth_bbox = self._get_bbox_smoother(tid).update(bbox)

                    # Detect face
                    face = self.face_detector.detect_in_person(frame, smooth_bbox)
                    if face is None:
                        continue

                    # Smooth face position with Kalman
                    smooth_face = self._get_face_smoother(tid).update(
                        face['face_center']
                    )

                    processed.append({
                        'track_id': tid,
                        'face_center': smooth_face,
                        'face_box': face['face_box'],
                        'face_area': face.get('face_area', 0),
                        'mouth_open': face.get('mouth_open', 0.0),
                        'bbox': smooth_bbox,
                        'estimated': face.get('estimated', False),
                    })

                # Speaker detection
                speaker_id = self.speaker_detector.update(processed)
                for p in processed:
                    p['is_speaker'] = (p['track_id'] == speaker_id)

                frame_data = {
                    'frame': frame_idx,
                    'person_count': len(processed),
                    'persons': processed,
                    'speaker_id': speaker_id,
                    'detected': True,
                }
                last_pos = frame_data
                det_count += 1
                positions.append(frame_data)
            else:
                # Reuse last detection, predict positions with Kalman
                if last_pos and last_pos['persons']:
                    predicted_persons = []
                    for p in last_pos['persons']:
                        tid = p['track_id']
                        predicted_face = self._get_face_smoother(tid).predict()
                        predicted_persons.append({
                            **p,
                            'face_center': predicted_face,
                        })
                    positions.append({
                        'frame': frame_idx,
                        'person_count': last_pos['person_count'],
                        'persons': predicted_persons,
                        'speaker_id': last_pos.get('speaker_id'),
                        'detected': False,
                    })
                else:
                    positions.append({
                        'frame': frame_idx,
                        'person_count': 0,
                        'persons': [],
                        'speaker_id': None,
                        'detected': False,
                    })

            frame_idx += 1

        cap.release()

        # Stats
        total = len(positions)
        multi = sum(1 for p in positions if p['person_count'] >= 2)
        print(f"[Tracker] ✅ Done: {total} frames, detected: {det_count}, "
              f"multi-person: {multi}")

        # Cleanup unused smoothers
        active_ids = set()
        for p in positions[-30:] if positions else []:
            for person in p.get('persons', []):
                active_ids.add(person['track_id'])
        for old_id in list(self._face_smoothers.keys()):
            if old_id not in active_ids:
                del self._face_smoothers[old_id]
        for old_id in list(self._bbox_smoothers.keys()):
            if old_id not in active_ids:
                del self._bbox_smoothers[old_id]

        return positions


# ═══════════════════════════════════════════════════════════════════════════
#  10. MAIN ENTRY POINT — YoloCenteredVideoCropper (API-compatible)
# ═══════════════════════════════════════════════════════════════════════════
class YoloCenteredVideoCropper:
    """
    Complete video processing pipeline v2.

    API: crop_to_aspect_ratio(video_path, output_path, start_time, end_time)
    (Same interface as before — drop-in replacement for services.py)

    Pipeline:
        1. FrameTracker → per-frame person + face + speaker data
        2. LayoutManager → stabilized grid/single decisions
        3. SmartCropper → person-aware cropping
        4. TransitionBlender → smooth crossfade between modes
        5. FFmpeg → HD 1080x1920 output
        6. Audio → merged from source
    """

    def __init__(self, mouth_position_ratio: float = 0.45, sample_rate: int = 1):
        self.tracker = FrameTracker(sample_rate=sample_rate)
        self.layout = LayoutManager()  # fps set later per-video
        self.head = HeadPositioner()
        self.cropper = SmartCropper(self.head)
        # crossfade only for grid→single exits; single→grid is always instant
        self.blender = TransitionBlender(crossfade_frames=10)
        self.mouth_position_ratio = mouth_position_ratio

    def track_only(self, video_path: str,
                   start_time: float = None,
                   end_time: float = None,
                   output_resolution: tuple = None) -> Dict:
        """
        Track persons only — return per-frame data WITHOUT rendering video.
        Used by single-pass overlay renderer to do crop + overlay in 1 encode.
        
        Args:
            video_path: Path to video file
            start_time: Start time in seconds
            end_time: End time in seconds
            output_resolution: Tuple (width, height) for output. Default (1080, 1920)
        
        Returns:
            Dict with 'positions', 'fps', 'width', 'height', and crop dimensions
        """
        # Step 1: Track all persons
        print("[Tracker] ═══ Tracking persons (data only) ═══")
        positions = self.tracker.track_video(video_path, start_time, end_time)

        # Get video info
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS)
        orig_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        orig_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        cap.release()

        # Output dimensions — configurable via parameter
        if output_resolution:
            out_w, out_h = output_resolution
        else:
            out_w, out_h = 1080, 1920
        half_h = out_h // 2
        target_ratio = out_w / out_h
        grid_ratio = out_w / half_h

        # Single-mode crop dimensions
        if orig_w / orig_h > target_ratio:
            crop_h = orig_h
            crop_w = int(orig_h * target_ratio)
        else:
            crop_w = orig_w
            crop_h = int(orig_w / target_ratio)

        # Pre-compute layout decisions per frame
        sf = int(start_time * fps) if start_time else 0
        ef = int(end_time * fps) if end_time else int(orig_h)  # approximate
        
        # Reset layout for fresh decisions
        self.layout = LayoutManager(fps=fps)
        
        layout_data = []
        for i, pos in enumerate(positions):
            frame_idx = pos.get('frame', sf + i)
            persons = pos.get('persons', [])
            speaker_id = pos.get('speaker_id')
            person_ids = [p['track_id'] for p in persons]

            use_grid = self.layout.update(len(persons), frame_idx, person_ids)
            use_grid = use_grid and len(persons) >= 2

            frame_layout = {
                'frame': frame_idx,
                'persons': persons,
                'speaker_id': speaker_id,
                'use_grid': use_grid,
            }

            if use_grid:
                if self.layout._grid_just_entered:
                    # First frame in grid — assign slots (who goes top/bottom)
                    self.layout.get_top_bottom(persons, speaker_id)
                    self.layout._grid_just_entered = False
                    print(f"[Layout] 📌 Grid slots assigned at frame {frame_idx}")

                # Use LIVE per-frame positions with locked slot assignments
                top_person, bottom_person = self.layout.get_top_bottom(
                    persons, speaker_id
                )
                frame_layout['top_person'] = top_person
                frame_layout['bottom_person'] = bottom_person

            layout_data.append(frame_layout)

        print(f"[Tracker] ✅ Tracking data ready: {len(layout_data)} frames")

        return {
            'positions': layout_data,
            'fps': fps,
            'orig_w': orig_w,
            'orig_h': orig_h,
            'out_w': out_w,
            'out_h': out_h,
            'half_h': half_h,
            'crop_w': crop_w,
            'crop_h': crop_h,
            'target_ratio': target_ratio,
            'grid_ratio': grid_ratio,
        }

    def crop_to_aspect_ratio(self, video_path: str,
                             face_positions: List[Dict] = None,
                             output_path: str = None,
                             start_time: float = None,
                             end_time: float = None,
                             output_resolution: tuple = None) -> str:
        """
        Full pipeline: Track → Layout → Crop → Blend → Render → Audio.
        """
        # ── Step 1: Track all persons ──
        print("[Pipeline] ═══ Step 1: Tracking persons ═══")
        positions = self.tracker.track_video(video_path, start_time, end_time)

        # ── Step 2: Open video for frame-by-frame rendering ──
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS)
        orig_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        orig_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        sf = int(start_time * fps) if start_time else 0
        ef = int(end_time * fps) if end_time else int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        if sf > 0:
            cap.set(cv2.CAP_PROP_POS_FRAMES, sf)

        # Output dimensions — configurable via parameter
        if output_resolution:
            out_w, out_h = output_resolution
        else:
            out_w, out_h = 1080, 1920
        half_h = out_h // 2
        target_ratio = out_w / out_h
        grid_ratio = out_w / half_h

        # Reset layout with actual video fps (3s threshold)
        self.layout = LayoutManager(fps=fps)

        # Single-mode crop dimensions
        if orig_w / orig_h > target_ratio:
            crop_h = orig_h
            crop_w = int(orig_h * target_ratio)
        else:
            crop_w = orig_w
            crop_h = int(orig_w / target_ratio)

        print(f"[Pipeline] Source: {orig_w}×{orig_h} → Output: {out_w}×{out_h}")

        if output_path is None:
            output_path = video_path.rsplit('.', 1)[0] + '_cropped.mp4'

        # ── Step 3: FFmpeg writer ──
        log_file = tempfile.NamedTemporaryFile(mode='w', suffix='_crop.log',
                                                delete=False)
        ffmpeg_cmd = [
            'ffmpeg', '-f', 'rawvideo', '-pix_fmt', 'bgr24',
            '-s', f'{out_w}x{out_h}', '-r', str(fps), '-i', '-',
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
            '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
            '-y', output_path
        ]
        proc = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE,
                                stdout=subprocess.DEVNULL, stderr=log_file)

        # ── Step 4: Render each frame ──
        print("[Pipeline] ═══ Step 2: Rendering frames ═══")
        pos_idx = 0
        written = 0
        grid_frames = 0
        single_frames = 0

        try:
            frame_idx = sf
            while frame_idx < ef:
                ret, frame = cap.read()
                if not ret:
                    break

                # Get tracking data
                if pos_idx < len(positions):
                    pos = positions[pos_idx]
                    persons = pos.get('persons', [])
                    speaker_id = pos.get('speaker_id')
                    pos_idx += 1
                else:
                    persons = []
                    speaker_id = None

                person_ids = [p['track_id'] for p in persons]
                use_grid = self.layout.update(
                    len(persons), frame_idx, person_ids
                )

                # ── Render based on mode ──
                if use_grid and len(persons) >= 2:
                    mode = 'grid'

                    if self.layout._grid_just_entered:
                        # First frame in grid — assign slots (who goes top/bottom)
                        self.layout.get_top_bottom(persons, speaker_id)
                        self.layout._grid_just_entered = False
                        print(f"[Layout] 📌 Grid slots assigned at frame {frame_idx}")

                    # Use LIVE per-frame positions with locked slot assignments
                    top_person, bottom_person = self.layout.get_top_bottom(
                        persons, speaker_id
                    )

                    # TOP = first assigned person, BOTTOM = second (spatially locked)
                    top_cell = self.cropper.crop_person_cell(
                        frame, top_person, grid_ratio, orig_w, orig_h,
                        out_w, half_h, headroom=0.30,
                        track_id=top_person.get('track_id', -1)
                    )
                    bottom_cell = self.cropper.crop_person_cell(
                        frame, bottom_person, grid_ratio, orig_w, orig_h,
                        out_w, half_h, headroom=0.28,
                        track_id=bottom_person.get('track_id', -1)
                    )

                    grid_render = np.vstack([top_cell, bottom_cell])
                    # Separator line
                    cv2.line(grid_render, (0, half_h), (out_w, half_h),
                             (30, 30, 30), 2)

                    current_render = grid_render
                    grid_frames += 1
                else:
                    mode = 'single'
                    if persons:
                        p = persons[0]
                        current_render = self.cropper.crop_single(
                            frame, p['face_center'], p.get('face_box', (0,0,100,100)),
                            crop_w, crop_h, orig_w, orig_h, out_w, out_h
                        )
                    else:
                        # No person — center crop
                        cx = orig_w // 2
                        cy = int(orig_h * 0.45)
                        x1 = max(0, cx - crop_w // 2)
                        y1 = max(0, cy - crop_h // 2)
                        x1 = min(x1, orig_w - crop_w)
                        y1 = min(y1, orig_h - crop_h)
                        current_render = cv2.resize(
                            frame[y1:y1+crop_h, x1:x1+crop_w],
                            (out_w, out_h), interpolation=cv2.INTER_LINEAR
                        )
                    single_frames += 1

                # ── Apply transition blending ──
                final = self.blender.blend(mode, frame_idx, current_render)

                proc.stdin.write(final.tobytes())
                written += 1
                frame_idx += 1

        finally:
            cap.release()
            proc.stdin.close()
            proc.wait()
            log_file.close()

        # Check FFmpeg result
        if proc.returncode != 0:
            try:
                with open(log_file.name, 'r') as f:
                    print(f"[Pipeline] FFmpeg err: {f.read()[-300:]}")
            except:
                pass
        try:
            os.remove(log_file.name)
        except:
            pass

        print(f"[Pipeline] ✅ Rendered {written} frames "
              f"(single: {single_frames}, grid: {grid_frames})")

        # ── Step 5: Add audio ──
        print("[Pipeline] ═══ Step 3: Adding audio ═══")
        self._add_audio(video_path, output_path, start_time, end_time)

        return output_path

    # ------------------------------------------------------------------
    #  Audio
    # ------------------------------------------------------------------
    def _add_audio(self, source: str, target: str,
                   start_time: float = None, end_time: float = None):
        try:
            temp = target.rsplit('.', 1)[0] + '_with_audio.mp4'
            cmd = ['ffmpeg', '-i', target]
            if start_time is not None:
                cmd.extend(['-ss', str(start_time)])
            if end_time is not None and start_time is not None:
                cmd.extend(['-t', str(end_time - start_time)])
            cmd.extend(['-i', source, '-map', '0:v:0', '-map', '1:a:0',
                        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
                        '-shortest', '-y', temp])
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0:
                os.replace(temp, target)
                print("[Pipeline] ✅ Audio merged")
            else:
                print(f"[Pipeline] FFmpeg audio err: {result.stderr[:200]}")
                self._add_audio_fallback(source, target, start_time, end_time)
        except Exception as e:
            print(f"[Pipeline] Audio error: {e}")
            self._add_audio_fallback(source, target, start_time, end_time)

    def _add_audio_fallback(self, source: str, target: str,
                            start_time: float = None, end_time: float = None):
        from moviepy import VideoFileClip
        src = tgt = final = None
        try:
            src = VideoFileClip(source)
            if src.audio:
                audio = (src.subclipped(start_time, end_time).audio
                         if start_time and end_time else src.audio)
                tgt = VideoFileClip(target)
                final = tgt.with_audio(audio)
                tmp = target.rsplit('.', 1)[0] + '_tmp.mp4'
                final.write_videofile(tmp, codec='libx264', audio_codec='aac',
                                      bitrate='8000k', logger=None)
                os.replace(tmp, target)
        except Exception as e:
            print(f"[Pipeline] MoviePy fallback failed: {e}")
        finally:
            for v in [final, tgt, src]:
                if v:
                    v.close()
