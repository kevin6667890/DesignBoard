import json
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session as SQLSession

from database import get_db
from models import InterviewBlueprint, JDProfile
from services.ai_service import analyze_jd, generate_blueprint

router = APIRouter()


class AnalyzeJDRequest(BaseModel):
    company_name: str | None = None
    role_title: str | None = None
    job_description: str
    interview_language: Literal["en", "zh"] = "en"


def _loads(value: str | None, fallback):
    if not value:
        return fallback
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


def profile_to_dict(profile: JDProfile) -> dict:
    return {
        "id": profile.id,
        "company_name": profile.company_name,
        "role_title": profile.role_title,
        "seniority": profile.seniority or "unknown",
        "domain": profile.domain or "general",
        "tech_stack": _loads(profile.tech_stack_json, []),
        "responsibilities": _loads(profile.responsibilities_json, []),
        "required_skills": _loads(profile.required_skills_json, []),
        "interview_focus": _loads(profile.interview_focus_json, []),
        "language": profile.language,
    }


def blueprint_to_dict(blueprint: InterviewBlueprint) -> dict:
    return {
        "id": blueprint.id,
        "profile_id": blueprint.profile_id,
        "summary": blueprint.summary or "",
        "coding_focus": _loads(blueprint.coding_focus_json, []),
        "cs_fundamentals_focus": _loads(blueprint.cs_fundamentals_focus_json, []),
        "system_design_focus": _loads(blueprint.system_design_focus_json, []),
        "domain_deep_dive_focus": _loads(blueprint.domain_deep_dive_focus_json, []),
        "behavioral_focus": _loads(blueprint.behavioral_focus_json, []),
        "custom_system_design_questions": _loads(blueprint.custom_system_design_questions_json, []),
        "scoring_focus": _loads(blueprint.scoring_focus_json, []),
    }


def _dumps(value) -> str:
    return json.dumps(value or [], ensure_ascii=False)


@router.post("/jd/analyze")
async def analyze_job_description(req: AnalyzeJDRequest, db: SQLSession = Depends(get_db)):
    jd_text = req.job_description.strip()
    if not jd_text:
        raise HTTPException(status_code=400, detail="Job description is required")

    profile_data = await analyze_jd(
        req.company_name.strip() if req.company_name else None,
        req.role_title.strip() if req.role_title else None,
        jd_text,
        req.interview_language,
    )
    blueprint_data = await generate_blueprint(profile_data, req.interview_language)

    profile = JDProfile(
        company_name=profile_data.get("company_name"),
        role_title=profile_data.get("role_title"),
        seniority=profile_data.get("seniority") or "unknown",
        domain=profile_data.get("domain") or "general",
        tech_stack_json=_dumps(profile_data.get("tech_stack")),
        responsibilities_json=_dumps(profile_data.get("responsibilities")),
        required_skills_json=_dumps(profile_data.get("required_skills")),
        interview_focus_json=_dumps(profile_data.get("interview_focus")),
        source_jd_text=jd_text,
        language=req.interview_language,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)

    blueprint = InterviewBlueprint(
        profile_id=profile.id,
        summary=blueprint_data.get("summary") or "",
        coding_focus_json=_dumps(blueprint_data.get("coding_focus")),
        cs_fundamentals_focus_json=_dumps(blueprint_data.get("cs_fundamentals_focus")),
        system_design_focus_json=_dumps(blueprint_data.get("system_design_focus")),
        domain_deep_dive_focus_json=_dumps(blueprint_data.get("domain_deep_dive_focus")),
        behavioral_focus_json=_dumps(blueprint_data.get("behavioral_focus")),
        custom_system_design_questions_json=_dumps(blueprint_data.get("custom_system_design_questions")),
        scoring_focus_json=_dumps(blueprint_data.get("scoring_focus")),
    )
    db.add(blueprint)
    db.commit()
    db.refresh(blueprint)

    return {
        "profile": profile_to_dict(profile),
        "blueprint": blueprint_to_dict(blueprint),
    }
