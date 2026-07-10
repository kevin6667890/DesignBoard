import json
import re
from io import BytesIO
from html.parser import HTMLParser
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session as SQLSession

from database import get_db
from models import CandidateProfile, CareerJob, InterviewBlueprint, JDProfile
from routers.jd import blueprint_to_dict, profile_to_dict
from services.ai_service import analyze_jd, analyze_pasted_job_page, analyze_resume, extract_job_leads, generate_blueprint, generate_job_search_plan, parse_career_job, score_career_job

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
    output_language: Literal["en", "zh"] = "en"


class ScoreJobRequest(BaseModel):
    output_language: Literal["en", "zh"] = "en"


class PrepareInterviewRequest(BaseModel):
    output_language: Literal["en", "zh"] = "en"

class SearchPlanRequest(BaseModel):
    target_role: str
    locations: list[str] = []
    term: str | None = None
    domain: str | None = None
    keywords: list[str] = []
    sources: list[str] = []
    remote_preference: Literal["remote", "hybrid", "onsite", "any"] = "any"
    experience_level: Literal["intern", "co-op", "new_grad", "any"] = "intern"
    output_language: Literal["en", "zh"] = "en"


class ExtractSearchRequest(BaseModel):
    pasted_text: str
    source_hint: str | None = "unknown"
    target_role: str | None = None
    locations: list[str] = []
    output_language: Literal["en", "zh"] = "en"


class FetchPublicRequest(BaseModel):
    urls: list[str]
    source_hint: str | None = "unknown"
    output_language: Literal["en", "zh"] = "en"


class JobLeadRequest(BaseModel):
    company_name: str | None = None
    role_title: str | None = None
    location: str | None = None
    source: str | None = None
    job_url: str | None = None
    application_url: str | None = None
    snippet: str | None = None
    confidence: int | None = None
    needs_jd: bool = True
    reason: str | None = None
    duplicate_key: str | None = None
    duplicate_warning: str | None = None


class SaveLeadsRequest(BaseModel):
    leads: list[JobLeadRequest]
    parse_and_score: bool = False
    output_language: Literal["en", "zh"] = "en"


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


def _has_profile_content(profile: dict) -> bool:
    return bool(profile.get("name") or profile.get("target_roles") or profile.get("skills") or profile.get("projects"))


def _unique_items(values: list) -> list:
    result = []
    seen = set()
    for value in values:
        key = json.dumps(value, ensure_ascii=False, sort_keys=True) if isinstance(value, dict) else str(value).strip().lower()
        if value and key not in seen:
            seen.add(key)
            result.append(value)
    return result


def _resume_to_profile_data(resume_profile: dict, existing: dict | None = None, merge: bool = False) -> dict:
    existing = existing or _profile_to_dict(None)
    skills = resume_profile.get("skills") if isinstance(resume_profile.get("skills"), dict) else {}
    existing_skills = existing.get("skills") if isinstance(existing.get("skills"), dict) else {}
    skill_keys = {"languages", "frontend", "backend", "databases", "cloud_devops", "ai_tools", "testing", "other"}
    merged_skills = {
        key: _unique_items((existing_skills.get(key) or []) + (skills.get(key) or [])) if merge else _unique_items(skills.get(key) or [])
        for key in skill_keys
    }
    preferences = resume_profile.get("preferences") if isinstance(resume_profile.get("preferences"), dict) else {}
    resume_preferences = {
        **preferences,
        "preferred_domains": resume_profile.get("preferred_domains") or preferences.get("preferred_domains") or [],
        "search_keywords": resume_profile.get("search_keywords") or [],
        "suggested_job_titles": resume_profile.get("suggested_job_titles") or [],
        "strengths": resume_profile.get("strengths") or [],
        "gaps": resume_profile.get("gaps") or [],
        "experience": resume_profile.get("experience") or [],
    }
    existing_preferences = existing.get("preferences") if isinstance(existing.get("preferences"), dict) else {}
    if merge:
        for key in ("preferred_domains", "search_keywords", "suggested_job_titles", "strengths", "gaps", "experience"):
            resume_preferences[key] = _unique_items((existing_preferences.get(key) or []) + (resume_preferences.get(key) or []))
    return {
        "name": resume_profile.get("name") or (existing.get("name") if merge else None),
        "target_roles": _unique_items((existing.get("target_roles") or []) + (resume_profile.get("target_roles") or [])) if merge else _unique_items(resume_profile.get("target_roles") or []),
        "target_locations": _unique_items((existing.get("target_locations") or []) + (resume_profile.get("target_locations") or [])) if merge else _unique_items(resume_profile.get("target_locations") or []),
        "education": {**(existing.get("education") or {}), **(resume_profile.get("education") or {})} if merge else (resume_profile.get("education") or {}),
        "work_authorization_notes": existing.get("work_authorization_notes") if merge else "",
        "skills": merged_skills,
        "projects": _unique_items((existing.get("projects") or []) + (resume_profile.get("projects") or [])) if merge else _unique_items(resume_profile.get("projects") or []),
        "preferences": {**existing_preferences, **resume_preferences} if merge else resume_preferences,
    }


def _get_job(db: SQLSession, job_id: int) -> CareerJob:
    job = db.query(CareerJob).filter(CareerJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job




class _ReadableTextParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts: list[str] = []
        self.skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "noscript", "svg"}:
            self.skip_depth += 1
        if tag in {"p", "div", "section", "article", "li", "br", "tr", "h1", "h2", "h3"}:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in {"script", "style", "noscript", "svg"} and self.skip_depth:
            self.skip_depth -= 1
        if tag in {"p", "div", "section", "article", "li", "tr", "h1", "h2", "h3"}:
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.skip_depth:
            value = data.strip()
            if value:
                self.parts.append(value)

    def text(self) -> str:
        return re.sub(r"\n{3,}", "\n\n", re.sub(r"[ \t]+", " ", " ".join(self.parts))).strip()


def _norm_text(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (value or "").lower()).strip()


def _lead_key(lead: dict | JobLeadRequest) -> str:
    data = lead.model_dump() if isinstance(lead, JobLeadRequest) else lead
    url = _norm_text(data.get("job_url") or data.get("application_url"))
    if url:
        return f"url:{url}"
    return "|".join([
        _norm_text(data.get("company_name")),
        _norm_text(data.get("role_title")),
        _norm_text(data.get("location")),
    ])


def _mark_duplicates(leads: list[dict], existing_jobs: list[CareerJob] | None = None) -> list[dict]:
    existing_keys = {_lead_key(_job_to_dict(job)) for job in (existing_jobs or [])}
    seen: dict[str, int] = {}
    output = []
    for lead in leads:
        key = _lead_key(lead)
        item = {**lead, "duplicate_key": key or None, "duplicate_warning": None}
        if key and key in existing_keys:
            item["duplicate_warning"] = "Already exists in tracker"
        elif key and key in seen:
            item["duplicate_warning"] = "Possible duplicate in extracted results"
        if key:
            seen[key] = seen.get(key, 0) + 1
        output.append(item)
    return output


def _fetch_public_text(url: str) -> tuple[str | None, str | None]:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None, "Invalid public URL."
    blocked = ["linkedin.com", "indeed.com", "glassdoor.com"]
    host = parsed.netloc.lower()
    if any(domain in host for domain in blocked):
        return None, "Paste this platform text manually. Public fetching is disabled for this source."
    try:
        req = Request(url, headers={"User-Agent": "DesignBoardJobSearchAgent/1.0"})
        with urlopen(req, timeout=8) as response:
            content_type = response.headers.get("content-type", "")
            raw = response.read(700000)
        if "text/html" not in content_type and "text/plain" not in content_type and content_type:
            return None, "Could not fetch this page. Paste the job description manually."
        html = raw.decode("utf-8", errors="replace")
        parser = _ReadableTextParser()
        parser.feed(html)
        text = parser.text() if "html" in content_type else html.strip()
        return text[:50000], None
    except (HTTPError, URLError, TimeoutError, ValueError):
        return None, "Could not fetch this page. Paste the job description manually."



@router.post("/career/search/plan")
def create_search_plan(req: SearchPlanRequest):
    if not req.target_role.strip():
        raise HTTPException(status_code=400, detail="target_role is required")
    return generate_job_search_plan({**req.model_dump(), "language": req.output_language})


@router.post("/career/search/extract")
async def extract_search_results(req: ExtractSearchRequest, db: SQLSession = Depends(get_db)):
    if not req.pasted_text.strip():
        raise HTTPException(status_code=400, detail="pasted_text is required")
    result = await extract_job_leads(
        req.pasted_text,
        req.source_hint,
        req.target_role,
        req.locations,
        req.output_language,
    )
    existing = db.query(CareerJob).all()
    result["job_leads"] = _mark_duplicates(result.get("job_leads") or [], existing)
    return result


@router.post("/career/search/fetch-public")
async def fetch_public_pages(req: FetchPublicRequest, db: SQLSession = Depends(get_db)):
    pages = []
    all_leads = []
    for url in req.urls[:8]:
        clean_url = (url or "").strip()
        if not clean_url:
            continue
        text, error = _fetch_public_text(clean_url)
        page = {"url": clean_url, "text": text, "error": error}
        if text:
            extracted = await extract_job_leads(text, req.source_hint, None, [], req.output_language)
            leads = extracted.get("job_leads") or []
            for lead in leads:
                lead["job_url"] = lead.get("job_url") or clean_url
                lead["source"] = lead.get("source") or req.source_hint or "Public URL"
            all_leads.extend(leads)
        pages.append(page)
    existing = db.query(CareerJob).all()
    return {"pages": pages, "job_leads": _mark_duplicates(all_leads, existing)}


@router.post("/career/search/save-leads")
async def save_search_leads(req: SaveLeadsRequest, db: SQLSession = Depends(get_db)):
    saved_jobs = []
    duplicates = []
    skipped = []
    existing = db.query(CareerJob).all()
    existing_keys = {_lead_key(_job_to_dict(job)) for job in existing}

    for lead in req.leads:
        data = lead.model_dump()
        key = _lead_key(data)
        if key and key in existing_keys:
            duplicates.append(data)
            continue
        if not (lead.company_name or lead.role_title or lead.job_url or lead.application_url or lead.snippet):
            skipped.append({"lead": data, "reason": "Missing company, role, URL, and snippet"})
            continue

        snippet = (lead.snippet or "").strip()
        enough_jd = len(snippet) >= 700
        notes_parts = ["Imported from Job Search Agent."]
        if lead.reason:
            notes_parts.append(f"Reason: {lead.reason}")
        if lead.confidence is not None:
            notes_parts.append(f"Confidence: {lead.confidence}/100")
        if lead.needs_jd or not enough_jd:
            notes_parts.append("Needs JD: paste the full job description before parsing or interview prep.")

        job = CareerJob(
            company_name=lead.company_name,
            role_title=lead.role_title,
            location=lead.location,
            job_url=lead.job_url,
            application_url=lead.application_url,
            source=lead.source or "Job Search Agent",
            raw_job_description=snippet if enough_jd else None,
            status="saved",
            priority="unknown",
            notes="\n".join(notes_parts + ([f"Snippet: {snippet[:1200]}"] if snippet and not enough_jd else [])),
            created_at=_now(),
            updated_at=_now(),
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        existing_keys.add(key)

        if req.parse_and_score and enough_jd:
            parsed = await parse_career_job(
                job.raw_job_description or "",
                job.company_name,
                job.role_title,
                job.location,
                _profile_to_dict(_active_profile(db)),
                req.output_language,
            )
            job.parsed_job_json = _dumps(parsed)
            score = await score_career_job(parsed, _profile_to_dict(_active_profile(db)), req.output_language)
            job.fit_score = score.get("overall_score")
            job.priority = score.get("priority") or "unknown"
            job.fit_summary = score.get("summary")
            job.fit_breakdown_json = _dumps(score)
            job.updated_at = _now()
            db.commit()
            db.refresh(job)
        saved_jobs.append(_job_to_dict(job))

    return {"saved_jobs": saved_jobs, "duplicates": duplicates, "skipped": skipped}

class PasteAnalyzeRequest(BaseModel):
    pasted_page_text: str
    source_hint: str | None = "unknown"
    job_url: str | None = None
    application_url: str | None = None
    notes: str | None = None
    output_language: Literal["en", "zh"] = "en"


class PasteSaveRequest(BaseModel):
    analysis_result: dict
    save_mode: Literal["save_only", "save_parse_score", "save_prepare_interview"] = "save_only"
    output_language: Literal["en", "zh"] = "en"


class ApplyResumeAnalysisRequest(BaseModel):
    resume_profile: dict
    merge_mode: Literal["replace", "merge"] = "replace"


@router.post("/career/paste/analyze")
async def paste_analyze(req: PasteAnalyzeRequest, db: SQLSession = Depends(get_db)):
    if not req.pasted_page_text.strip():
        raise HTTPException(status_code=400, detail="pasted_page_text is required")
    profile = _profile_to_dict(_active_profile(db))
    return await analyze_pasted_job_page(
        req.pasted_page_text,
        req.source_hint,
        req.job_url,
        req.application_url,
        profile,
        req.output_language,
    )


@router.post("/career/paste/save")
async def paste_save(req: PasteSaveRequest, db: SQLSession = Depends(get_db)):
    result = req.analysis_result
    if not result.get("is_job_posting"):
        raise HTTPException(status_code=400, detail="Cannot save: analysis result is not a job posting")

    extracted = result.get("extracted_job") or {}
    fit = result.get("fit") or {}
    cleaned_jd = result.get("cleaned_jd_text") or ""

    # Determine status from fit decision
    decision = fit.get("decision", "needs_more_info")
    if decision in ("apply", "maybe"):
        status = "ready_to_apply"
    else:
        status = "saved"

    priority = fit.get("priority") or "unknown"
    if priority not in PRIORITIES:
        priority = "unknown"

    notes_parts = ["Created from Pasted Job Page."]
    if result.get("ignored_noise"):
        noise_count = len(result["ignored_noise"])
        notes_parts.append(f"Noise removed: {noise_count} items.")

    job = CareerJob(
        company_name=extracted.get("company_name"),
        role_title=extracted.get("role_title"),
        location=extracted.get("location"),
        job_url=extracted.get("job_url"),
        application_url=extracted.get("application_url"),
        source=extracted.get("source") or "Pasted Page",
        raw_job_description=cleaned_jd or None,
        parsed_job_json=None,
        fit_score=fit.get("overall_score"),
        fit_summary=fit.get("summary"),
        fit_breakdown_json=_dumps(fit) if fit else None,
        status=status,
        priority=priority,
        notes="\n".join(notes_parts),
        created_at=_now(),
        updated_at=_now(),
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Build a parsed_job structure from extracted data (compatible with existing schema)
    parsed_job_struct = {
        "company_name": extracted.get("company_name"),
        "role_title": extracted.get("role_title"),
        "location": extracted.get("location"),
        "employment_type": extracted.get("employment_type", "unknown"),
        "term": extracted.get("term") or "",
        "domain": extracted.get("domain", "general"),
        "tech_stack": extracted.get("tech_stack", {}),
        "responsibilities": extracted.get("responsibilities", []),
        "required_skills": extracted.get("requirements", []),
        "nice_to_have": extracted.get("nice_to_have", []),
        "application_requirements": extracted.get("application_checklist", []),
        "deadline": extracted.get("deadline"),
        "work_authorization_signals": [],
        "ats_or_platform": extracted.get("source") or "unknown",
        "summary": extracted.get("summary", ""),
        "risk_flags": extracted.get("risk_flags", []),
    }
    job.parsed_job_json = _dumps(parsed_job_struct)
    db.commit()
    db.refresh(job)

    prepared_interview = None
    next_route = f"/career/jobs/{job.id}"

    if req.save_mode == "save_parse_score" and cleaned_jd:
        # Re-score with full pipeline
        profile = _profile_to_dict(_active_profile(db))
        score = await score_career_job(parsed_job_struct, profile, req.output_language)
        job.fit_score = score.get("overall_score")
        job.priority = score.get("priority") or priority
        job.fit_summary = score.get("summary")
        job.fit_breakdown_json = _dumps(score)
        job.updated_at = _now()
        db.commit()
        db.refresh(job)
        next_route = f"/career/jobs/{job.id}"

    elif req.save_mode == "save_prepare_interview" and cleaned_jd:
        try:
            profile_data = await analyze_jd(
                job.company_name, job.role_title, cleaned_jd, req.output_language
            )
            blueprint_data = await generate_blueprint(profile_data, req.output_language)

            jd_profile = JDProfile(
                company_name=profile_data.get("company_name"),
                role_title=profile_data.get("role_title"),
                seniority=profile_data.get("seniority") or "unknown",
                domain=profile_data.get("domain") or "general",
                tech_stack_json=_dumps(profile_data.get("tech_stack") or []),
                responsibilities_json=_dumps(profile_data.get("responsibilities") or []),
                required_skills_json=_dumps(profile_data.get("required_skills") or []),
                interview_focus_json=_dumps(profile_data.get("interview_focus") or []),
                source_jd_text=cleaned_jd,
                language=req.output_language,
            )
            db.add(jd_profile)
            db.commit()
            db.refresh(jd_profile)

            blueprint = InterviewBlueprint(
                profile_id=jd_profile.id,
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

            prepared_interview = {
                "profile": profile_to_dict(jd_profile),
                "blueprint": blueprint_to_dict(blueprint),
            }
            next_route = "/custom"
        except Exception:
            # If interview prep fails, still return the saved job
            next_route = f"/career/jobs/{job.id}"

    return {
        "job": _job_to_dict(job),
        "prepared_interview": prepared_interview,
        "next_route": next_route,
    }


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


@router.post("/career/profile/analyze-resume")
async def analyze_resume_profile(
    resume_file: UploadFile | None = File(default=None),
    resume_text: str | None = Form(default=None),
    output_language: Literal["en", "zh"] = Form(default="en"),
):
    text = (resume_text or "").strip()
    if resume_file:
        if resume_file.content_type not in {"application/pdf", "application/x-pdf"} and not (resume_file.filename or "").lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        content = await resume_file.read()
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Resume PDF must be 10MB or smaller.")
        try:
            from pypdf import PdfReader
            text = "\n".join(page.extract_text() or "" for page in PdfReader(BytesIO(content)).pages).strip()
        except Exception:
            raise HTTPException(status_code=422, detail="Could not extract text from PDF. Please paste resume text manually.")
    if not text:
        raise HTTPException(status_code=400, detail="Provide a resume PDF or paste resume text.")
    return await analyze_resume(text[:60000], output_language)


@router.post("/career/profile/apply-resume-analysis")
def apply_resume_analysis(req: ApplyResumeAnalysisRequest, db: SQLSession = Depends(get_db)):
    profile = _active_profile(db)
    existing = _profile_to_dict(profile)
    data = _resume_to_profile_data(req.resume_profile, existing, req.merge_mode == "merge")
    if not profile:
        profile = CandidateProfile(created_at=_now())
        db.add(profile)
    profile.name = data["name"]
    profile.target_roles_json = _dumps(data["target_roles"])
    profile.target_locations_json = _dumps(data["target_locations"])
    profile.education_json = _dumps(data["education"])
    profile.work_authorization_notes = data["work_authorization_notes"]
    profile.skills_json = _dumps(data["skills"])
    profile.projects_json = _dumps(data["projects"])
    profile.preferences_json = _dumps(data["preferences"])
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
        req.output_language,
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
            req.output_language,
        )
        job.parsed_job_json = _dumps(parsed)

    profile = _profile_to_dict(_active_profile(db))
    if not _has_profile_content(profile):
        warning = "请先添加或导入简历，以获得个性化匹配评分。" if req.output_language == "zh" else "Add or import your resume to get a personalized fit score."
        result = {
            "overall_score": 0,
            "priority": "unknown",
            "summary": warning,
            "breakdown": {},
            "matched_strengths": [],
            "gaps": [],
            "recommended_resume_keywords": [],
            "recommended_projects_to_highlight": [],
            "next_action": "needs_more_info",
            "personalization_warning": warning,
        }
    else:
        result = await score_career_job(parsed, profile, req.output_language)
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

    profile_data = await analyze_jd(job.company_name, job.role_title, raw_jd, req.output_language)
    blueprint_data = await generate_blueprint(profile_data, req.output_language)

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
        language=req.output_language,
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
