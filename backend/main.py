from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
from routers.questions import router as questions_router
from routers.sessions import router as sessions_router

# Create all tables
Base.metadata.create_all(bind=engine)

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
