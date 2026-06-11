"""
Repository Layer — Data access for keyframe animation system entities.
Provides CRUD + pagination + filtering for all 4 keyframe system tables.
"""
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List, Dict

from .keyframe_models import (
    KeyframeRegistryModel,
    CaptionTemplateModel,
    HookTemplateModel,
    StyleCompositionModel,
)


class KeyframeRegistryRepository:
    """Repository for keyframe_registry table — reusable animation templates."""

    def __init__(self, session: Session):
        self.session = session

    def get_all(
        self,
        category: Optional[str] = None,
        is_active: bool = True,
        page: int = 1,
        per_page: int = 20,
    ) -> List[KeyframeRegistryModel]:
        q = self.session.query(KeyframeRegistryModel)
        q = q.filter(KeyframeRegistryModel.is_active == is_active)
        if category is not None:
            q = q.filter(KeyframeRegistryModel.category == category)
        q = q.order_by(KeyframeRegistryModel.id)
        offset = (page - 1) * per_page
        return q.offset(offset).limit(per_page).all()

    def get_by_id(self, id: int) -> Optional[KeyframeRegistryModel]:
        return (
            self.session.query(KeyframeRegistryModel)
            .filter(KeyframeRegistryModel.id == id)
            .first()
        )

    def create(self, data: Dict) -> KeyframeRegistryModel:
        model = KeyframeRegistryModel(**data)
        self.session.add(model)
        self.session.commit()
        self.session.refresh(model)
        return model

    def update(self, id: int, data: Dict) -> Optional[KeyframeRegistryModel]:
        model = self.get_by_id(id)
        if not model:
            return None
        for key, value in data.items():
            if value is not None:
                setattr(model, key, value)
        self.session.commit()
        self.session.refresh(model)
        return model

    def soft_delete(self, id: int) -> bool:
        model = self.get_by_id(id)
        if not model:
            return False
        model.is_active = False
        self.session.commit()
        return True


class CaptionTemplateRepository:
    """Repository for caption_templates table — caption overlay style configs."""

    def __init__(self, session: Session):
        self.session = session

    def get_all(
        self,
        user_id: Optional[int] = None,
        category: Optional[str] = None,
        style_type: Optional[str] = None,
        is_active: bool = True,
        page: int = 1,
        per_page: int = 20,
    ) -> List[CaptionTemplateModel]:
        q = self.session.query(CaptionTemplateModel)
        q = q.filter(CaptionTemplateModel.is_active == is_active)
        if user_id is not None:
            # Show user's own templates + system presets (user_id IS NULL)
            q = q.filter(
                or_(
                    CaptionTemplateModel.user_id == user_id,
                    CaptionTemplateModel.user_id == None,
                )
            )
        if category is not None:
            q = q.filter(CaptionTemplateModel.category == category)
        if style_type is not None:
            q = q.filter(CaptionTemplateModel.style_type == style_type)
        q = q.order_by(CaptionTemplateModel.sort_order, CaptionTemplateModel.id)
        offset = (page - 1) * per_page
        return q.offset(offset).limit(per_page).all()

    def get_by_id(self, id: int) -> Optional[CaptionTemplateModel]:
        return (
            self.session.query(CaptionTemplateModel)
            .filter(CaptionTemplateModel.id == id)
            .first()
        )

    def get_default(self) -> Optional[CaptionTemplateModel]:
        return (
            self.session.query(CaptionTemplateModel)
            .filter(
                CaptionTemplateModel.is_default == True,
                CaptionTemplateModel.is_active == True,
            )
            .first()
        )

    def create(self, data: Dict) -> CaptionTemplateModel:
        model = CaptionTemplateModel(**data)
        self.session.add(model)
        self.session.commit()
        self.session.refresh(model)
        return model

    def update(
        self, id: int, data: Dict, user_id: Optional[int] = None
    ) -> Optional[CaptionTemplateModel]:
        model = self.get_by_id(id)
        if not model:
            return None
        # Ownership check: if user_id provided, must match template's user_id
        if user_id is not None and model.user_id is not None and model.user_id != user_id:
            return None
        for key, value in data.items():
            if value is not None:
                setattr(model, key, value)
        self.session.commit()
        self.session.refresh(model)
        return model

    def soft_delete(self, id: int, user_id: Optional[int] = None) -> bool:
        model = self.get_by_id(id)
        if not model:
            return False
        # Ownership check: if user_id provided, must match template's user_id
        if user_id is not None and model.user_id is not None and model.user_id != user_id:
            return False
        model.is_active = False
        self.session.commit()
        return True


class HookTemplateRepository:
    """Repository for hook_templates table — hook overlay style configs."""

    def __init__(self, session: Session):
        self.session = session

    def get_all(
        self,
        user_id: Optional[int] = None,
        category: Optional[str] = None,
        style_type: Optional[str] = None,
        is_active: bool = True,
        page: int = 1,
        per_page: int = 20,
    ) -> List[HookTemplateModel]:
        q = self.session.query(HookTemplateModel)
        q = q.filter(HookTemplateModel.is_active == is_active)
        if user_id is not None:
            q = q.filter(
                or_(
                    HookTemplateModel.user_id == user_id,
                    HookTemplateModel.user_id == None,
                )
            )
        if category is not None:
            q = q.filter(HookTemplateModel.category == category)
        if style_type is not None:
            q = q.filter(HookTemplateModel.style_type == style_type)
        q = q.order_by(HookTemplateModel.sort_order, HookTemplateModel.id)
        offset = (page - 1) * per_page
        return q.offset(offset).limit(per_page).all()

    def get_by_id(self, id: int) -> Optional[HookTemplateModel]:
        return (
            self.session.query(HookTemplateModel)
            .filter(HookTemplateModel.id == id)
            .first()
        )

    def get_default(self) -> Optional[HookTemplateModel]:
        return (
            self.session.query(HookTemplateModel)
            .filter(
                HookTemplateModel.is_default == True,
                HookTemplateModel.is_active == True,
            )
            .first()
        )

    def create(self, data: Dict) -> HookTemplateModel:
        model = HookTemplateModel(**data)
        self.session.add(model)
        self.session.commit()
        self.session.refresh(model)
        return model

    def update(
        self, id: int, data: Dict, user_id: Optional[int] = None
    ) -> Optional[HookTemplateModel]:
        model = self.get_by_id(id)
        if not model:
            return None
        # Ownership check
        if user_id is not None and model.user_id is not None and model.user_id != user_id:
            return None
        for key, value in data.items():
            if value is not None:
                setattr(model, key, value)
        self.session.commit()
        self.session.refresh(model)
        return model

    def soft_delete(self, id: int, user_id: Optional[int] = None) -> bool:
        model = self.get_by_id(id)
        if not model:
            return False
        # Ownership check
        if user_id is not None and model.user_id is not None and model.user_id != user_id:
            return False
        model.is_active = False
        self.session.commit()
        return True


class StyleCompositionRepository:
    """Repository for style_compositions table — pairs caption + hook templates."""

    def __init__(self, session: Session):
        self.session = session

    def get_all(
        self,
        user_id: Optional[int] = None,
        is_active: bool = True,
        page: int = 1,
        per_page: int = 20,
    ) -> List[StyleCompositionModel]:
        q = self.session.query(StyleCompositionModel)
        q = q.filter(StyleCompositionModel.is_active == is_active)
        if user_id is not None:
            q = q.filter(
                or_(
                    StyleCompositionModel.user_id == user_id,
                    StyleCompositionModel.user_id == None,
                )
            )
        q = q.order_by(StyleCompositionModel.sort_order, StyleCompositionModel.id)
        offset = (page - 1) * per_page
        return q.offset(offset).limit(per_page).all()

    def get_by_id(self, id: int) -> Optional[StyleCompositionModel]:
        return (
            self.session.query(StyleCompositionModel)
            .filter(StyleCompositionModel.id == id)
            .first()
        )

    def get_default(self) -> Optional[StyleCompositionModel]:
        return (
            self.session.query(StyleCompositionModel)
            .filter(
                StyleCompositionModel.is_default == True,
                StyleCompositionModel.is_active == True,
            )
            .first()
        )

    def create(self, data: Dict) -> StyleCompositionModel:
        model = StyleCompositionModel(**data)
        self.session.add(model)
        self.session.commit()
        self.session.refresh(model)
        return model

    def update(self, id: int, data: Dict) -> Optional[StyleCompositionModel]:
        model = self.get_by_id(id)
        if not model:
            return None
        for key, value in data.items():
            if value is not None:
                setattr(model, key, value)
        self.session.commit()
        self.session.refresh(model)
        return model

    def soft_delete(self, id: int) -> bool:
        model = self.get_by_id(id)
        if not model:
            return False
        model.is_active = False
        self.session.commit()
        return True

    def increment_use_count(self, id: int) -> bool:
        """Atomically increment use_count by 1."""
        result = (
            self.session.query(StyleCompositionModel)
            .filter(StyleCompositionModel.id == id)
            .update(
                {StyleCompositionModel.use_count: StyleCompositionModel.use_count + 1}
            )
        )
        self.session.commit()
        return result > 0
