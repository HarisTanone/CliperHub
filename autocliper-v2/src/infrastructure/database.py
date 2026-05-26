from sqlalchemy import create_engine, Column, Integer, BigInteger, String, Float, JSON, TIMESTAMP, ForeignKey, Boolean, Text
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session
from sqlalchemy.sql import func
import os
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


class FontModel(Base):
    __tablename__ = "fonts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    file_name = Column(String(255), nullable=False)
    download_url = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())


class HookStyleModel(Base):
    __tablename__ = "hook_styles"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    config = Column(JSON, nullable=False, default=dict)
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())


class CaptionStyleModel(Base):
    __tablename__ = "caption_styles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    font_id = Column(Integer, ForeignKey("fonts.id", ondelete="SET NULL"), nullable=True)
    font_family = Column(String(100), default="Arial")
    font_weight = Column(String(20), default="bold")
    font_size = Column(Integer, default=48)
    color = Column(String(20), default="#FFFF00")
    highlight_color = Column(String(20), default="#FFF45C")
    outline_color = Column(String(20), default="#000000")
    outline_width = Column(Integer, default=3)
    shadow_color = Column(String(20), default="#000000")
    shadow_offset_x = Column(Integer, default=2)
    shadow_offset_y = Column(Integer, default=2)
    line_spacing = Column(Float, default=1.0)
    caption_bottom_margin = Column(Integer, default=60)
    config = Column(JSON, nullable=True, default=None)  # Extended style config
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())


class RequestLogModel(Base):
    __tablename__ = "request_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    youtube_url = Column(String(255), nullable=False)
    caption_style_id = Column(Integer, ForeignKey("caption_styles.id"), nullable=False)
    hook_style_id = Column(BigInteger, ForeignKey("hook_styles.id", ondelete="SET NULL"), nullable=True)
    caption_response = Column(JSON, nullable=False)
    status = Column(String(50), default="pending")
    output_path = Column(String(500), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    requested_at = Column(TIMESTAMP, server_default=func.current_timestamp())


class UserModel(Base):
    """User accounts for API authentication"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="user")
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

class Database:
    def __init__(self):
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            raise RuntimeError("DATABASE_URL environment variable is required")
        
        # Auto-convert aiomysql to pymysql (we use synchronous SQLAlchemy)
        if 'aiomysql' in db_url:
            db_url = db_url.replace('aiomysql', 'pymysql')
        
        self.engine = create_engine(
            db_url,
            pool_size=5,
            max_overflow=10,
            pool_recycle=3600,
            pool_pre_ping=True,
            echo=False,
        )
        self.SessionLocal = sessionmaker(bind=self.engine)
    
    def get_session(self) -> Session:
        return self.SessionLocal()
    
    def create_tables(self):
        Base.metadata.create_all(bind=self.engine)

database = Database()