"""SQLAlchemy async engine, session, and ORM model."""
from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, Integer, String, Text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from src.config import settings

# Gunakan asyncmy sebagai driver (lebih stabil dari aiomysql dengan SQLAlchemy 2.x)
_db_url = settings.DATABASE_URL.replace("aiomysql", "asyncmy")

engine = create_async_engine(
    _db_url,
    pool_pre_ping=False,
    pool_size=5,
    max_overflow=10,
    pool_recycle=3600,
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class JobModel(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    youtube_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    video_duration: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="validating")
    render_progress: Mapped[str | None] = mapped_column(String(10), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    clips_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    clips_total: Mapped[int] = mapped_column(Integer, default=0)
    clips_success: Mapped[int] = mapped_column(Integer, default=0)
    clips_failed: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
