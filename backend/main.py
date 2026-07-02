from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from database import engine, Base
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


ensure_v2_columns()

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


@app.get("/api/health")
def health():
    return {"status": "ok"}
