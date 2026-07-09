from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from database import engine, Base
from routers.career import router as career_router
from routers.jd import router as jd_router
from routers.questions import router as questions_router
from routers.sessions import router as sessions_router

# Create all tables
Base.metadata.create_all(bind=engine)


def ensure_v2_columns():
    inspector = inspect(engine)
    if "messages" not in inspector.get_table_names():
        return

    existing = {column["name"] for column in inspector.get_columns("messages")}
    optional_columns = {
        "input_mode": "VARCHAR",
        "transcript_confidence": "FLOAT",
        "emotion_label": "VARCHAR",
    }

    with engine.begin() as conn:
        for name, column_type in optional_columns.items():
            if name not in existing:
                conn.execute(text(f"ALTER TABLE messages ADD COLUMN {name} {column_type}"))


def ensure_v25_v3_columns():
    inspector = inspect(engine)
    if "sessions" not in inspector.get_table_names():
        return

    existing = {column["name"] for column in inspector.get_columns("sessions")}
    optional_columns = {
        "interview_language": "VARCHAR DEFAULT 'en' NOT NULL",
        "session_type": "VARCHAR DEFAULT 'built_in' NOT NULL",
        "profile_id": "INTEGER",
        "blueprint_id": "INTEGER",
        "custom_question_title": "VARCHAR",
        "custom_question_context": "TEXT",
        "role_fit_summary": "TEXT",
    }

    with engine.begin() as conn:
        for name, column_type in optional_columns.items():
            if name not in existing:
                conn.execute(text(f"ALTER TABLE sessions ADD COLUMN {name} {column_type}"))


ensure_v2_columns()
ensure_v25_v3_columns()

app = FastAPI(title="DesignBoard API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(questions_router, prefix="/api")
app.include_router(sessions_router, prefix="/api")
app.include_router(jd_router, prefix="/api")
app.include_router(career_router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
