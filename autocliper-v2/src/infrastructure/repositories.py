"""
Repository Layer - Data access for domain entities
"""
from sqlalchemy.orm import Session
from typing import Optional, List
from .database import CaptionStyleModel, RequestLogModel, UserModel, FontModel, HookStyleModel
from ..domain.entities import CaptionStyle, RequestLog, ClipData, ProcessingState, Font, HookStyle


class FontRepository:
    def __init__(self, session: Session):
        self.session = session

    def create(self, data: dict) -> Font:
        model = FontModel(**data)
        self.session.add(model)
        self.session.commit()
        self.session.refresh(model)
        return self._to_entity(model)

    def get_by_id(self, font_id: int) -> Optional[Font]:
        m = self.session.query(FontModel).filter(FontModel.id == font_id).first()
        return self._to_entity(m) if m else None

    def get_all(self) -> List[Font]:
        return [self._to_entity(m) for m in self.session.query(FontModel).all()]

    def update(self, font_id: int, data: dict) -> Optional[Font]:
        m = self.session.query(FontModel).filter(FontModel.id == font_id).first()
        if not m:
            return None
        for k, v in data.items():
            if k in {'name', 'file_name', 'download_url'}:
                setattr(m, k, v)
        self.session.commit()
        self.session.refresh(m)
        return self._to_entity(m)

    def delete(self, font_id: int) -> bool:
        m = self.session.query(FontModel).filter(FontModel.id == font_id).first()
        if not m:
            return False
        self.session.delete(m)
        self.session.commit()
        return True

    def _to_entity(self, m: FontModel) -> Font:
        return Font(id=m.id, name=m.name, file_name=m.file_name,
                    download_url=m.download_url, created_at=m.created_at)


class HookStyleRepository:
    def __init__(self, session: Session):
        self.session = session

    def create(self, data: dict) -> HookStyle:
        model = HookStyleModel(**data)
        self.session.add(model)
        self.session.commit()
        self.session.refresh(model)
        return self._to_entity(model)

    def get_by_id(self, style_id: int) -> Optional[HookStyle]:
        m = self.session.query(HookStyleModel).filter(HookStyleModel.id == style_id).first()
        return self._to_entity(m) if m else None

    def get_all(self) -> List[HookStyle]:
        return [self._to_entity(m) for m in self.session.query(HookStyleModel).all()]

    def update(self, style_id: int, data: dict) -> Optional[HookStyle]:
        m = self.session.query(HookStyleModel).filter(HookStyleModel.id == style_id).first()
        if not m:
            return None
        for k, v in data.items():
            if k in {'name', 'config', 'is_active'}:
                setattr(m, k, v)
        self.session.commit()
        self.session.refresh(m)
        return self._to_entity(m)

    def delete(self, style_id: int) -> bool:
        m = self.session.query(HookStyleModel).filter(HookStyleModel.id == style_id).first()
        if not m:
            return False
        self.session.delete(m)
        self.session.commit()
        return True

    def _to_entity(self, m: HookStyleModel) -> HookStyle:
        return HookStyle(
            id=m.id, name=m.name, config=m.config or {},
            is_active=m.is_active, created_at=m.created_at,
            updated_at=m.updated_at,
        )


class CaptionStyleRepository:
    """Repository for caption styles"""

    def __init__(self, session: Session):
        self.session = session

    def create(self, data: dict) -> CaptionStyle:
        model = CaptionStyleModel(**data)
        self.session.add(model)
        self.session.commit()
        self.session.refresh(model)
        return self._to_entity(model)

    def get_by_id(self, style_id: int) -> Optional[CaptionStyle]:
        m = self.session.query(CaptionStyleModel).filter(CaptionStyleModel.id == style_id).first()
        return self._to_entity(m) if m else None

    def get_all(self, user_id: int = None, is_admin: bool = False) -> List[CaptionStyle]:
        """Admin sees all; user sees own styles + global (user_id IS NULL)."""
        q = self.session.query(CaptionStyleModel)
        if not is_admin and user_id is not None:
            from sqlalchemy import or_
            q = q.filter(or_(CaptionStyleModel.user_id == user_id,
                             CaptionStyleModel.user_id == None))
        return [self._to_entity(m) for m in q.all()]

    def update(self, style_id: int, data: dict, user_id: int = None, is_admin: bool = False) -> Optional[CaptionStyle]:
        m = self.session.query(CaptionStyleModel).filter(CaptionStyleModel.id == style_id).first()
        if not m:
            return None
        if not is_admin and m.user_id != user_id:
            return None  # not owner
        editable = {
            'name', 'font_id', 'font_weight', 'font_size', 'color', 'highlight_color',
            'outline_color', 'outline_width', 'shadow_color',
            'shadow_offset_x', 'shadow_offset_y', 'line_spacing', 'caption_bottom_margin',
            'config'
        }
        for k, v in data.items():
            if k in editable:
                setattr(m, k, v)
        # Sync font_family from fonts table if font_id provided
        if 'font_id' in data and data['font_id']:
            font = self.session.query(FontModel).filter_by(id=data['font_id']).first()
            if font:
                m.font_family = font.name
        self.session.commit()
        self.session.refresh(m)
        return self._to_entity(m)

    def delete(self, style_id: int, user_id: int = None, is_admin: bool = False) -> bool:
        m = self.session.query(CaptionStyleModel).filter(CaptionStyleModel.id == style_id).first()
        if not m:
            return False
        if not is_admin and m.user_id != user_id:
            return False
        self.session.delete(m)
        self.session.commit()
        return True

    def _to_entity(self, model: CaptionStyleModel) -> CaptionStyle:
        return CaptionStyle(
            id=model.id, name=model.name,
            font_id=model.font_id, font_family=model.font_family,
            font_weight=model.font_weight, font_size=model.font_size,
            color=model.color, highlight_color=model.highlight_color,
            outline_color=model.outline_color, outline_width=model.outline_width,
            shadow_color=model.shadow_color, shadow_offset_x=model.shadow_offset_x,
            shadow_offset_y=model.shadow_offset_y, line_spacing=model.line_spacing,
            caption_bottom_margin=model.caption_bottom_margin,
            user_id=model.user_id, created_at=model.created_at,
            config=model.config or {},
        )


class RequestLogRepository:
    """Repository for request logs"""
    
    def __init__(self, session: Session):
        self.session = session
    
    def create(self, request_log: RequestLog) -> RequestLog:
        """Create a new request log"""
        clips_json = self._clips_to_json(request_log.caption_response)
        status_value = request_log.status.value if isinstance(
            request_log.status, ProcessingState
        ) else request_log.status
        model = RequestLogModel(
            youtube_url=request_log.youtube_url,
            caption_style_id=request_log.caption_style_id,
            hook_style_id=request_log.hook_style_id,
            caption_response=clips_json,
            status=status_value,
            output_path=request_log.output_path,
            user_id=request_log.user_id,
            caption_template_id=getattr(request_log, 'caption_template_id', None),
            hook_template_id=getattr(request_log, 'hook_template_id', None),
            style_composition_id=getattr(request_log, 'style_composition_id', None),
            hook_text_raw=getattr(request_log, 'hook_text_raw', None),
        )
        self.session.add(model)
        self.session.commit()
        self.session.refresh(model)
        return self._to_entity(model, request_log.caption_response)
    
    def update(self, request_log: RequestLog) -> RequestLog:
        """Update an existing request log"""
        model = self.session.query(RequestLogModel).filter(
            RequestLogModel.id == request_log.id
        ).first()
        
        if not model:
            raise ValueError(f"RequestLog with id {request_log.id} not found")
        
        # Update fields
        model.caption_response = self._clips_to_json(request_log.caption_response)
        
        # Handle ProcessingState enum
        if isinstance(request_log.status, ProcessingState):
            model.status = request_log.status.value
        else:
            model.status = request_log.status
        
        model.output_path = request_log.output_path
        
        self.session.commit()
        self.session.refresh(model)
        
        return self._to_entity(model, request_log.caption_response)
    
    def get_by_id(self, log_id: int) -> Optional[RequestLog]:
        """Get request log by ID"""
        model = self.session.query(RequestLogModel).filter(
            RequestLogModel.id == log_id
        ).first()
        
        if not model:
            return None
        
        clips = self._json_to_clips(model.caption_response)
        return self._to_entity(model, clips)
    
    def get_all(self, user_id: int = None, is_admin: bool = False) -> List[RequestLog]:
        """Get all request logs. Non-admin users only see their own."""
        q = self.session.query(RequestLogModel).order_by(RequestLogModel.id.desc())
        if not is_admin and user_id is not None:
            q = q.filter(RequestLogModel.user_id == user_id)
        return [
            self._to_entity(m, self._json_to_clips(m.caption_response))
            for m in q.all()
        ]
    
    def get_pending_jobs(self) -> List[RequestLog]:
        """Get jobs with status pending or processing (for resume on server restart)."""
        models = self.session.query(RequestLogModel).filter(
            RequestLogModel.status.in_(['pending', 'processing'])
        ).order_by(RequestLogModel.id.asc()).all()
        return [self._to_entity(m, self._json_to_clips(m.caption_response)) for m in models]

    def get_existing_jobs(self, user_id: int = None, is_admin: bool = False) -> List[RequestLog]:
        """Get jobs whose output folder still exists on disk.
        
        Optimized: fetches only completed jobs with output_path set,
        then batch-checks filesystem instead of checking every row.
        """
        import os
        q = self.session.query(RequestLogModel).filter(
            RequestLogModel.output_path.isnot(None),
            RequestLogModel.status == 'completed'
        ).order_by(RequestLogModel.id.desc())
        if not is_admin and user_id is not None:
            q = q.filter(RequestLogModel.user_id == user_id)
        
        # Limit to recent jobs to avoid scanning hundreds of directories
        models = q.limit(50).all()
        
        result = []
        for m in models:
            if not m.output_path or not os.path.isdir(m.output_path):
                continue
            try:
                files = os.listdir(m.output_path)
                # Check for _final.mp4 (styled), _base.mp4 (base processed), or _raw.mp4 (raw clip)
                has_video = any(
                    f.endswith('_final.mp4') or f.endswith('_base.mp4') or f.endswith('_raw.mp4')
                    for f in files
                )
                if has_video:
                    clips = self._json_to_clips(m.caption_response)
                    result.append(self._to_entity(m, clips))
            except OSError:
                continue
        return result
    
    def delete(self, log_id: int) -> bool:
        """Delete a request log and optionally its output files"""
        import os, shutil
        model = self.session.query(RequestLogModel).filter(
            RequestLogModel.id == log_id
        ).first()
        if not model:
            return False
        output_path = model.output_path
        self.session.delete(model)
        self.session.commit()
        # Remove output directory if it exists
        if output_path and os.path.isdir(output_path):
            try:
                shutil.rmtree(output_path)
            except Exception as e:
                pass  # Log but don't fail
        return True
    
    def get_by_youtube_url(self, youtube_url: str, user_id: int = None) -> Optional[RequestLog]:
        """Get the most recent request log by YouTube URL (optionally scoped to user)."""
        q = self.session.query(RequestLogModel).filter(
            RequestLogModel.youtube_url == youtube_url
        )
        if user_id is not None:
            q = q.filter(RequestLogModel.user_id == user_id)
        model = q.order_by(RequestLogModel.id.desc()).first()
        
        if not model:
            return None
        
        clips = self._json_to_clips(model.caption_response)
        return self._to_entity(model, clips)
    
    def _clips_to_json(self, clips: List[ClipData]) -> List[dict]:
        """Convert ClipData list to JSON-serializable list"""
        if not clips:
            return []
        
        result = []
        for clip in clips:
            clip_dict = {
                "index": clip.index,
                "start_time": clip.start_time,
                "end_time": clip.end_time,
                "hook": clip.hook,
                "score": clip.score,
                "reason": clip.reason,
                "keywords": getattr(clip, 'keywords', []),
            }
            # Include multi-scores if available
            if hasattr(clip, 'scores') and clip.scores:
                clip_dict["scores"] = clip.scores.to_dict()
            if hasattr(clip, 'chunk_id') and clip.chunk_id is not None:
                clip_dict["chunk_id"] = clip.chunk_id
            result.append(clip_dict)
        
        return result
    
    def _json_to_clips(self, json_data: List[dict]) -> List[ClipData]:
        """Convert JSON list to ClipData list"""
        if not json_data:
            return []
        
        from ..domain.entities import ClipScores
        
        clips = []
        for clip in json_data:
            scores = None
            if "scores" in clip and clip["scores"]:
                s = clip["scores"]
                scores = ClipScores(
                    viral_score=s.get("viral_score", 0.0),
                    curiosity_score=s.get("curiosity_score", 0.0),
                    emotion_score=s.get("emotion_score", 0.0),
                    controversy_score=s.get("controversy_score", 0.0),
                    story_score=s.get("story_score", 0.0),
                )
            
            clips.append(ClipData(
                index=clip.get("index", 0),
                start_time=clip.get("start_time", 0.0),
                end_time=clip.get("end_time", 0.0),
                hook=clip.get("hook", ""),
                score=clip.get("score", 0.0),
                reason=clip.get("reason", ""),
                keywords=clip.get("keywords", []),
                scores=scores,
                chunk_id=clip.get("chunk_id"),
            ))
        
        return clips
    
    def _to_entity(self, model: RequestLogModel, clips: List[ClipData]) -> RequestLog:
        """Convert model to entity"""
        try:
            status = ProcessingState(model.status) if model.status else ProcessingState.PENDING
        except ValueError:
            status = ProcessingState.PENDING
        return RequestLog(
            id=model.id,
            youtube_url=model.youtube_url,
            caption_style_id=model.caption_style_id,
            hook_style_id=getattr(model, 'hook_style_id', None),
            caption_response=clips,
            status=status,
            output_path=model.output_path,
            requested_at=model.requested_at,
            user_id=model.user_id,
            caption_template_id=getattr(model, 'caption_template_id', None),
            hook_template_id=getattr(model, 'hook_template_id', None),
            style_composition_id=getattr(model, 'style_composition_id', None),
            hook_text_raw=getattr(model, 'hook_text_raw', None),
        )


class UserRepository:
    """Repository for user management and authentication"""

    def __init__(self, session: Session):
        self.session = session

    def get_by_username(self, username: str) -> Optional[UserModel]:
        return self.session.query(UserModel).filter(
            UserModel.username == username
        ).first()

    def get_by_id(self, user_id: int) -> Optional[UserModel]:
        return self.session.query(UserModel).filter(
            UserModel.id == user_id
        ).first()

    def get_all(self) -> List[UserModel]:
        return self.session.query(UserModel).order_by(UserModel.id).all()

    def create(self, username: str, hashed_password: str,
               email: Optional[str] = None, role: str = "user") -> UserModel:
        user = UserModel(
            username=username,
            email=email,
            hashed_password=hashed_password,
            role=role,
            is_active=True,
        )
        self.session.add(user)
        self.session.commit()
        self.session.refresh(user)
        return user

    def update(self, user_id: int, data: dict) -> Optional[UserModel]:
        """Update allowed fields: email, role, is_active, hashed_password"""
        user = self.get_by_id(user_id)
        if not user:
            return None
        allowed = {"email", "role", "is_active", "hashed_password"}
        for key, value in data.items():
            if key in allowed:
                setattr(user, key, value)
        self.session.commit()
        self.session.refresh(user)
        return user

    def delete(self, user_id: int) -> bool:
        user = self.get_by_id(user_id)
        if not user:
            return False
        self.session.delete(user)
        self.session.commit()
        return True