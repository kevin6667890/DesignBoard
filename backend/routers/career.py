import json
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session as SQLSession

from database import get_db
from models import CandidateProfile, CareerJob, InterviewBlueprint, JDProfile
from routers.jd import blueprint_to_dict, profile_to_dict
from services.ai_service import analyze_jd, generate_blueprint, parse_career_job, score_career_job

router = APIRouter()

JOB_STATUSES = {"saved", "ready_to_apply", "applied", "oa", "interview", "rejected", "offer", "archived"}
PRIORITIES = {"high", "medium", "low", "unknown"}


class CandidateProfileRequest(BaseModel):
    name: str | None = None
    target_roles: list[str] = []
    target_locations: list[str] = []
    education: dict = {}
    work_authorization_notes: str | None = None
    skills: dict = {}
    projects: list[dict] = []
    preferences: dict = {}


class CareerJobRequest(BaseModel):
    company_name: str | None = None
    role_title: str | None = None
    location: str | None = None
    job_url: str | None = None
    application_url: str | None = None
    source: str | None = None
    raw_job_description: str | None = None
    parsed_job: dict | None = None
    status: Literal["saved", "ready_to_apply", "applied", "oa", "interview", "rejected", "offer", "archived"] = "saved"
    priority: Literal["high", "medium", "low", "unknown"] = "unknown"
    notes: str | None = None


class ParseJobRequest(BaseModel):
    interview_language: Literal["en", "zh"] = "en"


class ScoreJobRequest(BaseModel):
    interview_language: Literal["en", "zh"] = "en"


class PrepareInterviewRequest(BaseModel):
    interview_language: Literal["en", "zh"] = "en"


def _loads(value: str | None, fallback):
    if not value:
        return fallback
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


def _dumps(value) -> str:
    return json.dumps(value, ensure_ascii=False)


def _now():
    return datetime.now(timezone.utc)


def _fmt_dt(dt) -> str | None:
    if dt is None:
        return None
    iso = dt.isoformat()
    if dt.tzinfo is None:
        iso += "Z"
    return iso


def _profile_to_dict(profile: CandidateProfile | None) -> dict:
    if not profile:
        return {
            "id": None,
            "name": None,
            "target_roles": [],
            "target_locations": [],
            "education": {},
            "work_authorization_notes": "",
            "skills": {
                "languages": [],
                "frontend": [],
                "backend": [],
                "databases": [],
                "cloud_devops": [],
                "ai_tools": [],
                "testing": [],
                "other": [],
            },
            "projects": [],
            "preferences": {},
            "created_at": None,
            "updated_at": None,
        }
    return {
        "id": profile.id,
        "name": profile.name,
        "target_roles": _loads(profile.target_roles_json, []),
        "target_locations": _loads(profile.target_locations_json, []),
        "education": _loads(profile.education_json, {}),
        "work_authorization_notes": profile.work_authorization_notes or "",
        "skills": _loads(profile.skills_json, {}),
        "projects": _loads(profile.projects_json, []),
        "preferences": _loads(profile.preferences_json, {}),
        "created_at": _fmt_dt(profile.created_at),
        "updated_at": _fmt_dt(profile.updated_at),
    }


def _job_to_dict(job: CareerJob) -> dict:
    return {
        "id": job.id,
        "company_name": job.company_name,
        "role_title": job.role_title,
        "location": job.location,
        "job_url": job.job_url,
        "application_url": job.application_url,
        "source": job.source,
        "raw_job_description": job.raw_job_description,
        "parsed_job": _loads(job.parsed_job_json, None),
        "fit_score": job.fit_score,
        "fit_summary": job.fit_summary,
        "fit_breakdown": _loads(job.fit_breakdown_json, None),
        "status": job.status,
        "priority": job.priority,
        "notes": job.notes,
        "created_at": _fmt_dt(job.created_at),
        "updated_at": _fmt_dt(job.updated_at),
    }


def _active_profile(db: SQLSession) -> CandidateProfile | None:
    return db.query(CandidateProfile).order_by(CandidateProfile.id.asc()).first()


def _get_job(db: SQLSession, job_id: int) -> CareerJob:
    job = db.query(CareerJob).filter(CareerJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/career/profile")
def get_candidate_profile(db: SQLSession = Depends(get_db)):
    return _profile_to_dict(_active_profile(db))


@router.put("/career/profile")
def upsert_candidate_profile(req: CandidateProfileRequest, db: SQLSession = Depends(get_db)):
    profile = _active_profile(db)
    if not profile:
        profile = CandidateProfile(created_at=_now())
        db.add(profile)

    profile.name = req.name
    profile.target_roles_json = _dumps(req.target_roles)
    profile.target_locations_json = _dumps(req.target_locations)
    profile.education_json = _dumps(req.education)
    profile.work_authorization_notes = req.work_authorization_notes
    profile.skills_json = _dumps(req.skills)
    profile.projects_json = _dumps(req.projects)
    profile.preferences_json = _dumps(req.preferences)
    profile.updated_at = _now()
    db.commit()
    db.refresh(profile)
    return _profile_to_dict(profile)


@router.get("/career/jobs")
def list_jobs(db: SQLSession = Depends(get_db)):
    jobs = db.query(CareerJob).order_by(CareerJob.updated_at.desc()).all()
    return [_job_to_dict(job) for job in jobs]


@router.post("/career/jobs")
def create_job(req: CareerJobRequest, db: SQLSession = Depends(get_db)):
    raw_jd = (req.raw_job_description or "").strip()
    status = req.status
    if not raw_jd and status == "ready_to_apply":
        status = "saved"
    job = CareerJob(
        company_name=req.company_name,
        role_title=req.role_title,
        location=req.location,
        job_url=req.job_url,
        application_url=req.application_url,
        source=req.source,
        raw_job_description=raw_jd or None,
        parsed_job_json=_dumps(req.parsed_job) if req.parsed_job else None,
        status=status,
        priority=req.priority,
        notes=req.notes,
        created_at=_now(),
        updated_at=_now(),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return _job_to_dict(job)


@router.get("/career/jobs/{job_id}")
def get_job(job_id: int, db: SQLSession = Depends(get_db)):
    return _job_to_dict(_get_job(db, job_id))


@router.put("/career/jobs/{job_id}")
def update_job(job_id: int, req: CareerJobRequest, db: SQLSession = Depends(get_db)):
    job = _get_job(db, job_id)
    job.company_name = req.company_name
    job.role_title = req.role_title
    job.location = req.location
    job.job_url = req.job_url
    job.application_url = req.application_url
    job.source = req.source
    job.raw_job_description = (req.raw_job_description or "").strip() or None
    if req.parsed_job is not None:
        job.parsed_job_json = _dumps(req.parsed_job)
    job.status = req.status if req.status in JOB_STATUSES else job.status
    job.priority = req.priority if req.priority in PRIORITIES else job.priority
    job.notes = req.notes
    job.updated_at = _now()
    db.commit()
    db.refresh(job)
    return _job_to_dict(job)


@router.delete("/career/jobs/{job_id}")
def delete_job(job_id: int, db: SQLSession = Depends(get_db)):
    job = _get_job(db, job_id)
    db.delete(job)
    db.commit()
    return {"ok": True}


@router.post("/career/jobs/{job_id}/parse")
async def parse_job(job_id: int, req: ParseJobRequest, db: SQLSession = Depends(get_db)):
    job = _get_job(db, job_id)
    profile = _profile_to_dict(_active_profile(db))
    parsed = await parse_career_job(
        job.raw_job_description or "",
        job.company_name,
        job.role_title,
        job.location,
        profile,
        req.interview_language,
    )
    job.parsed_job_json = _dumps(parsed)
    job.company_name = parsed.get("company_name") or job.company_name
    job.role_title = parsed.get("role_title") or job.role_title
    job.location = parsed.get("location") or job.location
    if job.raw_job_description:
        job.status = "ready_to_apply" if job.status == "saved" else job.status
    job.updated_at = _now()
    db.commit()
    db.refresh(job)
    return _job_to_dict(job)


@router.post("/career/jobs/{job_id}/score")
async def score_job(job_id: int, req: ScoreJobRequest, db: SQLSession = Depends(get_db)):
    job = _get_job(db, job_id)
    parsed = _loads(job.parsed_job_json, None)
    if not parsed:
        parsed = await parse_career_job(
            job.raw_job_description or "",
            job.company_name,
            job.role_title,
            job.location,
            _profile_to_dict(_active_profile(db)),
            req.interview_language,
        )
        job.parsed_job_json = _dumps(parsed)

    result = await score_career_job(parsed, _profile_to_dict(_active_profile(db)), req.interview_language)
    job.fit_score = result.get("overall_score")
    job.priority = result.get("priority") or "unknown"
    job.fit_summary = result.get("summary")
    job.fit_breakdown_json = _dumps(result)
    job.updated_at = _now()
    db.commit()
    db.refresh(job)
    return _job_to_dict(job)


@router.post("/career/jobs/{job_id}/prepare-interview")
async def prepare_interview(job_id: int, req: PrepareInterviewRequest, db: SQLSession = Depends(get_db)):
    job = _get_job(db, job_id)
    raw_jd = (job.raw_job_description or "").strip()
    if not raw_jd:
        raise HTTPException(status_code=400, detail="Add or paste the job description before generating a tailored interview.")

    profile_data = await analyze_jd(job.company_name, job.role_title, raw_jd, req.interview_language)
    blueprint_data = await generate_blueprint(profile_data, req.interview_language)

    profile = JDProfile(
        company_name=profile_data.get("company_name"),
        role_title=profile_data.get("role_title"),
        seniority=profile_data.get("seniority") or "unknown",
        domain=profile_data.get("domain") or "general",
        tech_stack_json=_dumps(profile_data.get("tech_stack") or []),
        responsibilities_json=_dumps(profile_data.get("responsibilities") or []),
        required_skills_json=_dumps(profile_data.get("required_skills") or []),
        interview_focus_json=_dumps(profile_data.get("interview_focus") or []),
        source_jd_text=raw_jd,
        language=req.interview_language,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)

    blueprint = InterviewBlueprint(
        profile_id=profile.id,
        summary=blueprint_data.get("summary") or "",
        coding_focus_json=_dumps(blueprint_data.get("coding_focus") or []),
        cs_fundamentals_focus_json=_dumps(blueprint_data.get("cs_fundamentals_focus") or []),
        system_design_focus_json=_dumps(blueprint_data.get("system_design_focus") or []),
        domain_deep_dive_focus_json=_dumps(blueprint_data.get("domain_deep_dive_focus") or []),
        behavioral_focus_json=_dumps(blueprint_data.get("behavioral_focus") or []),
        custom_system_design_questions_json=_dumps(blueprint_data.get("custom_system_design_questions") or []),
        scoring_focus_json=_dumps(blueprint_data.get("scoring_focus") or []),
    )
    db.add(blueprint)
    db.commit()
    db.refresh(blueprint)

    return {
        "profile": profile_to_dict(profile),
        "blueprint": blueprint_to_dict(blueprint),
    }
