"""
Domain Interfaces - Abstract base classes for dependency inversion
"""
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from .entities import ClipData, VideoInfo


class IAIAnalyzer(ABC):
    """Interface for AI video analysis service (provider pattern)"""
    
    @abstractmethod
    def analyze_video(self, video_path: str) -> List[Dict[str, Any]]:
        """
        Analyze video to find best clip segments
        
        Args:
            video_path: Path to the video file
            
        Returns:
            List of clip data with start_time, end_time, hook, score, reason
        """
        pass
    
    @abstractmethod
    def analyze_candidates(self, transcript_chunk: str, metadata: Dict[str, Any],
                           chunk_id: int, chunk_start_time: float) -> List[ClipData]:
        """Pass #1: Detect candidate clips from a transcript chunk.
        
        Args:
            transcript_chunk: JSON transcript segment
            metadata: Video metadata (title, duration, channel, etc.)
            chunk_id: Chunk identifier
            chunk_start_time: Absolute start time of this chunk in seconds
            
        Returns:
            List of ClipData candidates with multi-scores
        """
        pass
    
    @abstractmethod
    def rank_candidates(self, candidates: List[ClipData], metadata: Dict[str, Any],
                        transcript_snippets: Dict[int, str]) -> List[ClipData]:
        """Pass #2: Final ranking of aggregated candidates.
        
        Args:
            candidates: Pre-filtered candidate clips from aggregator
            metadata: Video metadata
            transcript_snippets: Map of clip index → relevant transcript text
            
        Returns:
            Final ranked list of ClipData with hooks, keywords, reasons
        """
        pass


class IVideoDownloader(ABC):
    """Interface for video download service"""
    
    @abstractmethod
    def download(self, url: str, output_dir: str) -> Dict[str, Any]:
        """
        Download video from URL
        
        Args:
            url: Video URL (YouTube)
            output_dir: Directory to save the video
            
        Returns:
            Dict with title, duration, filepath
        """
        pass


class IVideoClipper(ABC):
    """Interface for video clipping service"""
    
    @abstractmethod
    def cut_video(self, video_path: str, start_time: float, end_time: float, output_path: str) -> str:
        """
        Cut video segment
        
        Args:
            video_path: Source video path
            start_time: Start time in seconds
            end_time: End time in seconds
            output_path: Output file path
            
        Returns:
            Path to the cut video
        """
        pass


class IAudioExtractor(ABC):
    """Interface for audio extraction service"""
    
    @abstractmethod
    def extract_audio(self, video_path: str, output_path: str) -> str:
        """
        Extract audio from video
        
        Args:
            video_path: Source video path
            output_path: Output audio path
            
        Returns:
            Path to extracted audio
        """
        pass


class ISubtitleGenerator(ABC):
    """Interface for subtitle generation service"""
    
    @abstractmethod
    def generate_subtitles(self, audio_path: str) -> List[Dict[str, Any]]:
        """
        Generate subtitles from audio using Whisper
        
        Args:
            audio_path: Path to audio file
            
        Returns:
            List of subtitle segments with start, end, text
        """
        pass


class IFaceDetector(ABC):
    """Interface for face detection service"""
    
    @abstractmethod
    def detect_faces(self, frame) -> List[Dict[str, Any]]:
        """
        Detect faces in a frame
        
        Args:
            frame: Video frame (numpy array)
            
        Returns:
            List of face locations/bounding boxes
        """
        pass


class IFaceTracker(ABC):
    """Interface for face tracking across frames"""
    
    @abstractmethod
    def track_speaking_face(self, frames: List, audio_segments: List) -> List[Dict[str, Any]]:
        """
        Track the speaking face across video frames
        
        Args:
            frames: List of video frames
            audio_segments: Audio segments for lip sync
            
        Returns:
            List of crop boxes per frame
        """
        pass


class IVideoCropper(ABC):
    """Interface for video cropping to aspect ratio"""
    
    @abstractmethod
    def crop_to_aspect_ratio(self, video_path: str, face_positions: List, output_path: str, 
                              aspect_ratio: tuple = (9, 16)) -> str:
        """
        Crop video to aspect ratio following face
        
        Args:
            video_path: Source video path
            face_positions: List of face positions per frame
            output_path: Output video path
            aspect_ratio: Target aspect ratio (width, height)
            
        Returns:
            Path to cropped video
        """
        pass


class IOverlayRenderer(ABC):
    """Interface for text overlay rendering"""
    
    @abstractmethod
    def render_hook(self, video_path: str, hook_text: str, duration: float) -> str:
        """
        Render hook text overlay on video
        
        Args:
            video_path: Source video path
            hook_text: Hook text to display
            duration: Duration to show hook (seconds)
            
        Returns:
            Path to video with hook overlay
        """
        pass
    
    @abstractmethod
    def render_subtitles(self, video_path: str, subtitles: List[Dict], 
                         style: Dict[str, Any], start_offset: float = 3.0) -> str:
        """
        Render subtitles with style
        
        Args:
            video_path: Source video path
            subtitles: List of subtitle segments
            style: Caption style from database
            start_offset: Time offset to start showing subtitles (for hook)
            
        Returns:
            Path to video with subtitles
        """
        pass
