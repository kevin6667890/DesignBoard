import json
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session as SQLSession

from database import get_db
from models import InterviewBlueprint, JDProfile, Session, Message
from routers.jd import blueprint_to_dict, profile_to_dict
from routers.questions import DIFFICULTY_MAP, TITLE_MAP
from services.ai_service import generate_opening_message, stream_ai_response, evaluate_session

router = APIRouter()


class CreateSessionRequest(BaseModel):
    question_id: str | None = None
    interview_language: Literal["en", "zh"] = "en"
    profile_id: int | None = None
    blueprint_id: int | None = None
    custom_question_title: str | None = None
    custom_question_context: dict | None = None
    difficulty: str | None = None


class SendMessageRequest(BaseModel):
    content: str
    emotion_label: str | None = None
    input_mode: Literal["text", "voice"] | None = None
    transcript_confidence: float | None = None


def _fmt_dt(dt) -> str | None:
    if dt is None:
        return None
    iso = dt.isoformat()
    # SQLite returns naive datetimes; we know they are stored as UTC, so add Z
    if dt.tzinfo is None:
        iso += "Z"
    return iso


def _session_to_dict(session: Session) -> dict:
    profile = profile_to_dict(session.profile) if session.profile else None
    return {
        "id": session.id,
        "question_id": session.question_id,
        "question_title": session.question_title,
        "difficulty": session.difficulty,
        "interview_language": getattr(session, "interview_language", "en") or "en",
        "session_type": getattr(session, "session_type", "built_in") or "built_in",
        "profile_id": session.profile_id,
        "blueprint_id": session.blueprint_id,
        "custom_question_title": session.custom_question_title,
        "custom_question_context": json.loads(session.custom_question_context) if session.custom_question_context else None,
        "profile": profile,
        "started_at": _fmt_dt(session.started_at),
        "ended_at": _fmt_dt(session.ended_at),
        "duration_seconds": session.duration_seconds,
        "status": session.status,
        "score_requirements": session.score_requirements,
        "score_components": session.score_components,
        "score_scalability": session.score_scalability,
        "score_data_modeling": session.score_data_modeling,
        "score_communication": session.score_communication,
        "score_total": session.score_total,
        "missed_points": json.loads(session.missed_points) if session.missed_points else None,
        "summary": session.summary,
        "role_fit_summary": session.role_fit_summary,
    }


def _message_to_dict(message: Message) -> dict:
    return {
        "id": message.id,
        "session_id": message.session_id,
        "role": message.role,
        "content": message.content,
        "input_mode": message.input_mode,
        "transcript_confidence": message.transcript_confidence,
        "created_at": _fmt_dt(message.created_at),
    }


@router.post("/sessions")
async def create_session(req: CreateSessionRequest, db: SQLSession = Depends(get_db)):
    is_custom = bool(req.custom_question_title or req.profile_id or req.blueprint_id)
    profile = None
    blueprint = None

    if is_custom:
        if not req.custom_question_title:
            raise HTTPException(status_code=400, detail="Custom question title is required")
        if req.profile_id:
            profile = db.query(JDProfile).filter(JDProfile.id == req.profile_id).first()
            if not profile:
                raise HTTPException(status_code=404, detail="Profile not found")
        if req.blueprint_id:
            blueprint = db.query(InterviewBlueprint).filter(InterviewBlueprint.id == req.blueprint_id).first()
            if not blueprint:
                raise HTTPException(status_code=404, detail="Blueprint not found")
        question_id = f"custom-{req.blueprint_id or 'jd'}"
        difficulty = req.difficulty or "Medium"
        title = req.custom_question_title
    else:
        question_id = req.question_id
        if not question_id or question_id not in DIFFICULTY_MAP:
            raise HTTPException(status_code=404, detail="Question not found")
        difficulty = DIFFICULTY_MAP[question_id]
        title = TITLE_MAP[question_id]

    session = Session(
        question_id=question_id,
        question_title=title,
        difficulty=difficulty,
        interview_language=req.interview_language,
        session_type="jd_tailored" if is_custom else "built_in",
        profile_id=req.profile_id if is_custom else None,
        blueprint_id=req.blueprint_id if is_custom else None,
        custom_question_title=req.custom_question_title if is_custom else None,
        custom_question_context=json.dumps(req.custom_question_context, ensure_ascii=False) if req.custom_question_context else None,
        status="active",
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    opening_text = await generate_opening_message(title, req.interview_language)

    message = Message(
        session_id=session.id,
        role="interviewer",
        content=opening_text,
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    return {
        "session": _session_to_dict(session),
        "opening_message": _message_to_dict(message),
    }


def _session_context(session: Session) -> tuple[dict | None, dict | None, list]:
    profile = profile_to_dict(session.profile) if session.profile else None
    blueprint = blueprint_to_dict(session.blueprint) if session.blueprint else None
    scoring_focus = blueprint.get("scoring_focus", []) if blueprint else []
    return profile, blueprint, scoring_focus


@router.get("/sessions")
def list_sessions(db: SQLSession = Depends(get_db)):
    sessions = db.query(Session).order_by(Session.started_at.desc()).all()
    return [_session_to_dict(s) for s in sessions]


@router.get("/sessions/{session_id}")
def get_session(session_id: int, db: SQLSession = Depends(get_db)):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = db.query(Message).filter(
        Message.session_id == session_id
    ).order_by(Message.created_at).all()

    return {
        "session": _session_to_dict(session),
        "messages": [_message_to_dict(m) for m in messages],
    }


@router.post("/sessions/{session_id}/messages")
async def send_message(session_id: int, req: SendMessageRequest, db: SQLSession = Depends(get_db)):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "active":
        raise HTTPException(status_code=400, detail="Session is not active")

    # Save candidate message
    candidate_msg = Message(
        session_id=session_id,
        role="candidate",
        content=req.content,
        input_mode=req.input_mode or "text",
        transcript_confidence=req.transcript_confidence,
        emotion_label=req.emotion_label,
    )
    db.add(candidate_msg)
    db.commit()

    # Fetch full conversation history
    messages = db.query(Message).filter(
        Message.session_id == session_id
    ).order_by(Message.created_at).all()

    history = [{"role": m.role, "content": m.content} for m in messages]

    # We need to pass db reference to the streaming generator to save the final message
    async def event_stream():
        full_response = ""
        profile, blueprint, _ = _session_context(session)
        async for chunk in stream_ai_response(
            history,
            req.emotion_label,
            session.interview_language,
            profile,
            blueprint,
            session.custom_question_context,
        ):
            full_response += chunk
            yield f"data: {json.dumps({'delta': chunk, 'done': False})}\n\n"

        # Save the assistant message
        assistant_msg = Message(
            session_id=session_id,
            role="interviewer",
            content=full_response,
        )
        db.add(assistant_msg)
        db.commit()

        yield f"data: {json.dumps({'delta': '', 'done': True})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
    )


@router.post("/sessions/{session_id}/end")
async def end_session(session_id: int, db: SQLSession = Depends(get_db)):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "active":
        return _session_to_dict(session)  # Already ended

    # Compute duration — SQLite returns naive datetimes, treat as UTC
    now = datetime.now(timezone.utc)
    session.ended_at = now
    started_at_utc = (
        session.started_at.replace(tzinfo=timezone.utc)
        if session.started_at.tzinfo is None
        else session.started_at
    )
    duration = (now - started_at_utc).total_seconds()
    session.duration_seconds = int(duration)
    session.status = "completed"

    # Fetch full transcript
    messages = db.query(Message).filter(
        Message.session_id == session_id
    ).order_by(Message.created_at).all()

    transcript_lines = []
    for m in messages:
        speaker = "Interviewer" if m.role == "interviewer" else "Candidate"
        transcript_lines.append(f"{speaker}: {m.content}")

    transcript = "\n\n".join(transcript_lines)

    # Get evaluation
    try:
        _, _, scoring_focus = _session_context(session)
        evaluation = await evaluate_session(transcript, session.interview_language, scoring_focus)
        session.score_requirements = evaluation.get("requirements_clarification")
        session.score_components = evaluation.get("system_components")
        session.score_scalability = evaluation.get("scalability")
        session.score_data_modeling = evaluation.get("data_modeling")
        session.score_communication = evaluation.get("communication")
        total = sum([
            evaluation.get("requirements_clarification", 0),
            evaluation.get("system_components", 0),
            evaluation.get("scalability", 0),
            evaluation.get("data_modeling", 0),
            evaluation.get("communication", 0),
        ])
        session.score_total = total
        session.missed_points = json.dumps(evaluation.get("missed_points", []))
        session.summary = evaluation.get("summary", "")
        session.role_fit_summary = evaluation.get("role_fit_summary")
    except Exception as e:
        # If evaluation fails, set default scores
        session.score_requirements = 0
        session.score_components = 0
        session.score_scalability = 0
        session.score_data_modeling = 0
        session.score_communication = 0
        session.score_total = 0
        session.missed_points = json.dumps([])
        session.summary = "Evaluation failed. Please try again."
        session.role_fit_summary = None

    db.commit()
    db.refresh(session)

    return _session_to_dict(session)
