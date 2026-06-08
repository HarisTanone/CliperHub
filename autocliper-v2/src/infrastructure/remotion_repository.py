"""
Repository layer untuk Remotion templates & render jobs.
Implements CRUD operations against the remotion_* tables.
"""
import logging
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_

from .remotion_models import (
    RemotionCaptionTemplateModel,
    RemotionHookTemplateModel,
    RemotionCompositionModel,
    RemotionRenderJobModel,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
#  Caption Template Repository
# ─────────────────────────────────────────────────────────────────────────────

class RemotionCaptionTemplateRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_all(self, user_id: Optional[int] = None, category: Optional[str] = None) -> List[RemotionCaptionTemplateModel]:
        """Get all active caption templates (global + user's own)."""
        q = self.session.query(RemotionCaptionTemplateModel).filter(
            RemotionCaptionTemplateModel.is_active == True
        )
        if category:
            q = q.filter(RemotionCaptionTemplateModel.category == category)
        if user_id:
            q = q.filter(
                (RemotionCaptionTemplateModel.user_id == None) |
                (RemotionCaptionTemplateModel.user_id == user_id)
            )
        else:
            q = q.filter(RemotionCaptionTemplateModel.user_id == None)
        return q.order_by(RemotionCaptionTemplateModel.sort_order).all()

    def get_by_id(self, template_id: int) -> Optional[RemotionCaptionTemplateModel]:
        return self.session.query(RemotionCaptionTemplateModel).filter(
            RemotionCaptionTemplateModel.id == template_id
        ).first()

    def get_default(self) -> Optional[RemotionCaptionTemplateModel]:
        return self.session.query(RemotionCaptionTemplateModel).filter(
            RemotionCaptionTemplateModel.is_default == True,
            RemotionCaptionTemplateModel.user_id == None,
        ).first()

    def create(self, data: Dict[str, Any]) -> RemotionCaptionTemplateModel:
        obj = RemotionCaptionTemplateModel(**data)
        self.session.add(obj)
        self.session.commit()
        self.session.refresh(obj)
        return obj

    def update(self, template_id: int, data: Dict[str, Any], user_id: Optional[int] = None) -> Optional[RemotionCaptionTemplateModel]:
        obj = self.get_by_id(template_id)
        if not obj:
            return None
        # Only allow user to update their own (unless admin passes user_id=None)
        if user_id and obj.user_id and obj.user_id != user_id:
            return None
        for k, v in data.items():
            if hasattr(obj, k):
                setattr(obj, k, v)
        self.session.commit()
        self.session.refresh(obj)
        return obj

    def delete(self, template_id: int, user_id: Optional[int] = None) -> bool:
        obj = self.get_by_id(template_id)
        if not obj:
            return False
        if user_id and obj.user_id and obj.user_id != user_id:
            return False
        self.session.delete(obj)
        self.session.commit()
        return True


# ─────────────────────────────────────────────────────────────────────────────
#  Hook Template Repository
# ─────────────────────────────────────────────────────────────────────────────

class RemotionHookTemplateRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_all(self, user_id: Optional[int] = None, category: Optional[str] = None) -> List[RemotionHookTemplateModel]:
        q = self.session.query(RemotionHookTemplateModel).filter(
            RemotionHookTemplateModel.is_active == True
        )
        if category:
            q = q.filter(RemotionHookTemplateModel.category == category)
        if user_id:
            q = q.filter(
                (RemotionHookTemplateModel.user_id == None) |
                (RemotionHookTemplateModel.user_id == user_id)
            )
        else:
            q = q.filter(RemotionHookTemplateModel.user_id == None)
        return q.order_by(RemotionHookTemplateModel.sort_order).all()

    def get_by_id(self, template_id: int) -> Optional[RemotionHookTemplateModel]:
        return self.session.query(RemotionHookTemplateModel).filter(
            RemotionHookTemplateModel.id == template_id
        ).first()

    def get_default(self) -> Optional[RemotionHookTemplateModel]:
        return self.session.query(RemotionHookTemplateModel).filter(
            RemotionHookTemplateModel.is_default == True,
            RemotionHookTemplateModel.user_id == None,
        ).first()

    def create(self, data: Dict[str, Any]) -> RemotionHookTemplateModel:
        obj = RemotionHookTemplateModel(**data)
        self.session.add(obj)
        self.session.commit()
        self.session.refresh(obj)
        return obj

    def update(self, template_id: int, data: Dict[str, Any], user_id: Optional[int] = None) -> Optional[RemotionHookTemplateModel]:
        obj = self.get_by_id(template_id)
        if not obj:
            return None
        if user_id and obj.user_id and obj.user_id != user_id:
            return None
        for k, v in data.items():
            if hasattr(obj, k):
                setattr(obj, k, v)
        self.session.commit()
        self.session.refresh(obj)
        return obj

    def delete(self, template_id: int, user_id: Optional[int] = None) -> bool:
        obj = self.get_by_id(template_id)
        if not obj:
            return False
        if user_id and obj.user_id and obj.user_id != user_id:
            return False
        self.session.delete(obj)
        self.session.commit()
        return True


# ─────────────────────────────────────────────────────────────────────────────
#  Composition Repository
# ─────────────────────────────────────────────────────────────────────────────

class RemotionCompositionRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_all(self, user_id: Optional[int] = None) -> List[RemotionCompositionModel]:
        q = self.session.query(RemotionCompositionModel).filter(
            RemotionCompositionModel.is_active == True
        )
        if user_id:
            q = q.filter(
                (RemotionCompositionModel.user_id == None) |
                (RemotionCompositionModel.user_id == user_id)
            )
        else:
            q = q.filter(RemotionCompositionModel.user_id == None)
        return q.order_by(RemotionCompositionModel.sort_order).all()

    def get_by_id(self, comp_id: int) -> Optional[RemotionCompositionModel]:
        return self.session.query(RemotionCompositionModel).filter(
            RemotionCompositionModel.id == comp_id
        ).first()

    def get_default(self) -> Optional[RemotionCompositionModel]:
        return self.session.query(RemotionCompositionModel).filter(
            RemotionCompositionModel.is_default == True,
            RemotionCompositionModel.user_id == None,
        ).first()

    def create(self, data: Dict[str, Any]) -> RemotionCompositionModel:
        obj = RemotionCompositionModel(**data)
        self.session.add(obj)
        self.session.commit()
        self.session.refresh(obj)
        return obj

    def update(self, comp_id: int, data: Dict[str, Any]) -> Optional[RemotionCompositionModel]:
        obj = self.get_by_id(comp_id)
        if not obj:
            return None
        for k, v in data.items():
            if hasattr(obj, k):
                setattr(obj, k, v)
        self.session.commit()
        self.session.refresh(obj)
        return obj

    def increment_use_count(self, comp_id: int):
        obj = self.get_by_id(comp_id)
        if obj:
            obj.use_count = (obj.use_count or 0) + 1
            self.session.commit()

    def delete(self, comp_id: int) -> bool:
        obj = self.get_by_id(comp_id)
        if not obj:
            return False
        self.session.delete(obj)
        self.session.commit()
        return True


# ─────────────────────────────────────────────────────────────────────────────
#  Render Job Repository
# ─────────────────────────────────────────────────────────────────────────────

class RemotionRenderJobRepository:
    def __init__(self, session: Session):
        self.session = session

    def create(self, data: Dict[str, Any]) -> RemotionRenderJobModel:
        obj = RemotionRenderJobModel(**data)
        self.session.add(obj)
        self.session.commit()
        self.session.refresh(obj)
        return obj

    def get_by_id(self, job_id: int) -> Optional[RemotionRenderJobModel]:
        return self.session.query(RemotionRenderJobModel).filter(
            RemotionRenderJobModel.id == job_id
        ).first()

    def get_by_request(self, request_log_id: int) -> List[RemotionRenderJobModel]:
        return self.session.query(RemotionRenderJobModel).filter(
            RemotionRenderJobModel.request_log_id == request_log_id
        ).order_by(RemotionRenderJobModel.clip_index).all()

    def get_pending(self, limit: int = 10) -> List[RemotionRenderJobModel]:
        return self.session.query(RemotionRenderJobModel).filter(
            RemotionRenderJobModel.status == "pending"
        ).order_by(RemotionRenderJobModel.queued_at).limit(limit).all()

    def update_status(self, job_id: int, status: str, **kwargs) -> Optional[RemotionRenderJobModel]:
        obj = self.get_by_id(job_id)
        if not obj:
            return None
        obj.status = status
        for k, v in kwargs.items():
            if hasattr(obj, k):
                setattr(obj, k, v)
        self.session.commit()
        self.session.refresh(obj)
        return obj

    def get_stats(self) -> Dict[str, int]:
        from sqlalchemy import func as sa_func
        results = self.session.query(
            RemotionRenderJobModel.status,
            sa_func.count(RemotionRenderJobModel.id)
        ).group_by(RemotionRenderJobModel.status).all()
        return {status: count for status, count in results}
