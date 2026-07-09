from sqlalchemy import Column, Float, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from database import Base


class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    question_id = Column(String, nullable=False)
    question_title = Column(String, nullable=False)
    difficulty = Column(String, nullable=False)
    interview_language = Column(String, default="en", nullable=False)
    session_type = Column(String, default="built_in", nullable=False)
    profile_id = Column(Integer, ForeignKey("jd_profiles.id"), nullable=True)
    blueprint_id = Column(Integer, ForeignKey("interview_blueprints.id"), nullable=True)
    custom_question_title = Column(String, nullable=True)
    custom_question_context = Column(Text, nullable=True)
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
    role_fit_summary = Column(Text, nullable=True)

    messages = relationship("Message", back_populates="session", order_by="Message.created_at", cascade="all, delete-orphan")
    profile = relationship("JDProfile")
    blueprint = relationship("InterviewBlueprint")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    input_mode = Column(String, nullable=True)
    transcript_confidence = Column(Float, nullable=True)
    emotion_label = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    session = relationship("Session", back_populates="messages")


class JDProfile(Base):
    __tablename__ = "jd_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_name = Column(String, nullable=True)
    role_title = Column(String, nullable=True)
    seniority = Column(String, nullable=True)
    domain = Column(String, nullable=True)
    tech_stack_json = Column(Text, nullable=True)
    responsibilities_json = Column(Text, nullable=True)
    required_skills_json = Column(Text, nullable=True)
    interview_focus_json = Column(Text, nullable=True)
    source_jd_text = Column(Text, nullable=False)
    language = Column(String, default="en", nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class InterviewBlueprint(Base):
    __tablename__ = "interview_blueprints"

    id = Column(Integer, primary_key=True, autoincrement=True)
    profile_id = Column(Integer, ForeignKey("jd_profiles.id"), nullable=False)
    summary = Column(Text, nullable=True)
    coding_focus_json = Column(Text, nullable=True)
    cs_fundamentals_focus_json = Column(Text, nullable=True)
    system_design_focus_json = Column(Text, nullable=True)
    domain_deep_dive_focus_json = Column(Text, nullable=True)
    behavioral_focus_json = Column(Text, nullable=True)
    custom_system_design_questions_json = Column(Text, nullable=True)
    scoring_focus_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    profile = relationship("JDProfile")


class CandidateProfile(Base):
    __tablename__ = "candidate_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=True)
    target_roles_json = Column(Text, nullable=True)
    target_locations_json = Column(Text, nullable=True)
    education_json = Column(Text, nullable=True)
    work_authorization_notes = Column(Text, nullable=True)
    skills_json = Column(Text, nullable=True)
    projects_json = Column(Text, nullable=True)
    preferences_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class CareerJob(Base):
    __tablename__ = "career_jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_name = Column(String, nullable=True)
    role_title = Column(String, nullable=True)
    location = Column(String, nullable=True)
    job_url = Column(Text, nullable=True)
    application_url = Column(Text, nullable=True)
    source = Column(String, nullable=True)
    raw_job_description = Column(Text, nullable=True)
    parsed_job_json = Column(Text, nullable=True)
    fit_score = Column(Integer, nullable=True)
    fit_summary = Column(Text, nullable=True)
    fit_breakdown_json = Column(Text, nullable=True)
    status = Column(String, default="saved", nullable=False)
    priority = Column(String, default="unknown", nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
