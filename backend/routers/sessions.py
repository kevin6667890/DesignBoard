import json
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session as SQLSession

from database import get_db
from models import Session, Message
from routers.questions import DIFFICULTY_MAP, TITLE_MAP
from services.ai_service import generate_opening_message, stream_ai_response, evaluate_session

router = APIRouter()


class CreateSessionRequest(BaseModel):
    question_id: str


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
    return {
        "id": session.id,
        "question_id": session.question_id,
        "question_title": session.question_title,
        "difficulty": session.difficulty,
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
    question_id = req.question_id
    if question_id not in DIFFICULTY_MAP:
        raise HTTPException(status_code=404, detail="Question not found")

    difficulty = DIFFICULTY_MAP[question_id]
    title = TITLE_MAP[question_id]

    session = Session(
        question_id=question_id,
        question_title=title,
        difficulty=difficulty,
        status="active",
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    opening_text = await generate_opening_message(title)

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
        async for chunk in stream_ai_response(history, req.emotion_label):
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
        evaluation = await evaluate_session(transcript)
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

    db.commit()
    db.refresh(session)

    return _session_to_dict(session)
