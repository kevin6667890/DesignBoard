from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from database import Base


class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    question_id = Column(String, nullable=False)
    question_title = Column(String, nullable=False)
    difficulty = Column(String, nullable=False)
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    ended_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    status = Column(String, default="active", nullable=False)
    score_requirements = Column(Integer, nullable=True)
    score_components = Column(Integer, nullable=True)
    score_scalability = Column(Integer, nullable=True)
    score_data_modeling = Column(Integer, nullable=True)
    score_communication = Column(Integer, nullable=True)
    score_total = Column(Integer, nullable=True)
    missed_points = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)

    messages = relationship("Message", back_populates="session", order_by="Message.created_at", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    session = relationship("Session", back_populates="messages")
