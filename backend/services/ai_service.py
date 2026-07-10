import json
import os
from typing import AsyncGenerator

from dotenv import load_dotenv
from openai import AsyncOpenAI

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

client = AsyncOpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com",
)

INTERVIEWER_SYSTEM_PROMPT_EN = """You are Alex, a senior software engineer at a FAANG-level tech company conducting a system design interview.

Your style:
- Terse, professional, evaluative. Not warm, not hostile. You have done 300 of these.
- Ask ONE focused question at a time. Never dump multiple questions in one response.
- Keep your responses to 2-4 sentences max during the interview. Do not lecture.
- Do NOT hint at the right answer or coach the candidate.
- If a candidate says something vague, press them: "Can you be more specific?", "What does that actually mean at scale?"
- If an answer is weak, probe it: "What happens when that database node goes down?", "How does this handle 10M concurrent users?"
- If an answer is strong, escalate: move to a harder sub-problem immediately.
- If the candidate goes quiet: "What are you considering right now?"

Topics to probe naturally throughout the conversation (not all at once):
1. Requirements clarification - functional vs non-functional, scale assumptions
2. Capacity estimation - QPS, storage, bandwidth
3. High-level architecture - components, services, data flow
4. Data modeling - schema design, SQL vs NoSQL with real reasoning
5. API design - endpoints, request/response contracts
6. Scalability - caching strategy, sharding, CDN, load balancing, queues
7. Failure modes - what breaks, how to detect it, how to recover"""

INTERVIEWER_SYSTEM_PROMPT_ZH = """你是 Alex，一位资深软件工程师，正在进行系统设计面试。

你的风格：
- 简洁、专业、有评估感，不热情寒暄，也不攻击候选人。
- 每次只问一个聚焦问题，不要一次抛出多个问题。
- 面试中每次回复控制在 2-4 句，不讲课。
- 不暗示正确答案，不辅导候选人。
- 如果回答含糊，要追问具体含义和规模下如何成立。
- 如果回答较弱，要追问故障、扩展性或一致性问题。
- 如果回答较强，马上提高难度，进入更深的子问题。

自然覆盖这些方向，但不要一次性全部问完：
1. 需求澄清 - 功能需求、非功能需求、规模假设
2. 容量估算 - QPS、存储、带宽
3. 高层架构 - 组件、服务、数据流
4. 数据建模 - schema、SQL/NoSQL 的取舍
5. API 设计 - endpoint、请求/响应契约
6. 可扩展性 - cache、shard、CDN、load balancing、queue
7. 故障模式 - 什么会坏，如何检测，如何恢复

保留必要英文技术术语，例如 API、cache、queue、shard、consistency。"""
EMOTION_CONTEXT = {
    "nervous": "The candidate appears nervous. Ask a clearer, more grounded follow-up and reduce ambiguity slightly.",
    "confused": "The candidate appears confused. Reframe the question without giving away the answer.",
    "confident": "The candidate appears confident. Increase difficulty and ask deeper scalability or failure-mode questions.",
    "focused": "The candidate appears focused. Continue normally.",
}


def _json_dumps(value) -> str:
    return json.dumps(value, ensure_ascii=False)


def _extract_json_object(text: str) -> dict:
    try:
        start = text.index("{")
        end = text.rindex("}") + 1
        return json.loads(text[start:end])
    except (ValueError, json.JSONDecodeError) as exc:
        raise ValueError(f"Failed to parse JSON response: {text}") from exc


def _safe_list(value) -> list:
    return value if isinstance(value, list) else []


def _safe_str(value) -> str:
    return value.strip() if isinstance(value, str) else ""


def _build_opening_message(question_title: str, interview_language: str = "en") -> str:
    if interview_language == "zh":
        return (
            f"你好，我是 Alex。今天我们做这道系统设计题：{question_title}。"
            "你有 45 分钟，请边想边说。"
            "先从需求澄清开始，你有什么问题？"
        )
    return (
        f"Hi, I'm Alex. Today we're going to work on: {question_title}. "
        "You have 45 minutes. I want you to think out loud as you go. "
        "To start - what clarifying questions do you have about the requirements?"
    )

def _build_jd_context(profile: dict | None, blueprint: dict | None, custom_question_context: str | None) -> str:
    if not profile and not blueprint and not custom_question_context:
        return ""
    return (
        "Hidden JD-tailored interview context. Use it to prioritize follow-up questions, but do not repeatedly mention it:\n"
        f"Profile: {_json_dumps(profile or {})}\n"
        f"Blueprint: {_json_dumps(blueprint or {})}\n"
        f"Selected question context: {custom_question_context or ''}"
    )


def _build_conversation_messages(
    history: list[dict],
    emotion_label: str | None = None,
    interview_language: str = "en",
    profile: dict | None = None,
    blueprint: dict | None = None,
    custom_question_context: str | None = None,
) -> list[dict]:
    system_prompt = INTERVIEWER_SYSTEM_PROMPT_ZH if interview_language == "zh" else INTERVIEWER_SYSTEM_PROMPT_EN
    messages = [{"role": "system", "content": system_prompt}]
    if interview_language == "zh":
        messages.append({"role": "system", "content": "所有面试追问必须使用自然中文，必要技术术语可保留英文。"})
    emotion_instruction = EMOTION_CONTEXT.get(emotion_label or "")
    if emotion_instruction:
        messages.append({"role": "system", "content": f"[Candidate state: {emotion_instruction}]"})
    jd_context = _build_jd_context(profile, blueprint, custom_question_context)
    if jd_context:
        messages.append({"role": "system", "content": jd_context})
    for msg in history:
        role = "assistant" if msg["role"] == "interviewer" else "user"
        messages.append({"role": role, "content": msg["content"]})
    return messages


def _build_evaluation_prompt(transcript: str, interview_language: str = "en", scoring_focus: list | None = None) -> str:
    language_instruction = (
        "Write missed_points, summary, and role_fit_summary in Chinese."
        if interview_language == "zh"
        else "Write missed_points, summary, and role_fit_summary in English."
    )
    jd_instruction = ""
    role_fit_schema = ""
    if scoring_focus:
        jd_instruction = f"""
This was a JD-tailored interview. Also assess alignment against these role-specific expectations:
{_json_dumps(scoring_focus)}
"""
        role_fit_schema = ',\n  "role_fit_summary": "..."'

    return (
        "You conducted a system design interview. Here is the full transcript:\n\n"
        f"{transcript}\n\n"
        f"{language_instruction}\n{jd_instruction}\n"
        "Evaluate the candidate on exactly these 5 dimensions, score each 0 to 10: "
        "requirements_clarification, system_components, scalability, data_modeling, communication.\n"
        "Also provide missed_points as exactly 3-5 specific items and summary as 2-3 direct sentences.\n"
        "Respond ONLY with valid JSON. No markdown, no explanation, no preamble. "
        "Required keys: requirements_clarification, system_components, scalability, data_modeling, "
        "communication, missed_points, summary."
        + (" Include role_fit_summary." if scoring_focus else "")
    )


async def generate_opening_message(question_title: str, interview_language: str = "en") -> str:
    return _build_opening_message(question_title, interview_language)


async def stream_ai_response(
    history: list[dict],
    emotion_label: str | None = None,
    interview_language: str = "en",
    profile: dict | None = None,
    blueprint: dict | None = None,
    custom_question_context: str | None = None,
) -> AsyncGenerator[str, None]:
    messages = _build_conversation_messages(
        history,
        emotion_label,
        interview_language,
        profile,
        blueprint,
        custom_question_context,
    )
    stream = await client.chat.completions.create(
        model="deepseek-chat",
        max_tokens=1024,
        messages=messages,
        stream=True,
    )
    async for chunk in stream:
        content = chunk.choices[0].delta.content
        if content:
            yield content


async def evaluate_session(transcript: str, interview_language: str = "en", scoring_focus: list | None = None) -> dict:
    response = await client.chat.completions.create(
        model="deepseek-chat",
        max_tokens=2048,
        messages=[{"role": "user", "content": _build_evaluation_prompt(transcript, interview_language, scoring_focus)}],
    )
    return _extract_json_object(response.choices[0].message.content)


def _fallback_profile(company_name: str | None, role_title: str | None, language: str) -> dict:
    return {
        "company_name": company_name,
        "role_title": role_title,
        "seniority": "unknown",
        "domain": "general",
        "tech_stack": [],
        "responsibilities": [],
        "required_skills": [],
        "interview_focus": ["system design fundamentals"] if language == "en" else ["绯荤粺璁捐鍩虹"],
    }


def _fallback_blueprint(language: str) -> dict:
    if language == "zh":
        return {
            "summary": "基于 JD 信息生成的通用系统设计面试计划。",
            "coding_focus": ["数据结构与工程实现能力"],
            "cs_fundamentals_focus": ["网络、数据库、并发基础"],
            "system_design_focus": ["需求澄清", "高层架构", "扩展性", "故障处理"],
            "domain_deep_dive_focus": ["结合岗位领域追问关键取舍"],
            "behavioral_focus": ["项目 ownership", "沟通与协作"],
            "custom_system_design_questions": [{
                "title": "设计一个符合该岗位场景的核心业务系统",
                "difficulty": "medium",
                "why_relevant": "覆盖 JD 中的系统设计和工程能力要求。",
                "expected_topics": ["API", "数据模型", "cache", "queue", "scalability"],
            }],
            "scoring_focus": ["系统设计基本功", "岗位相关技术取舍"],
        }
    return {
        "summary": "Generic system design interview plan based on the available JD signals.",
        "coding_focus": ["Data structures and implementation quality"],
        "cs_fundamentals_focus": ["Networking, databases, and concurrency basics"],
        "system_design_focus": ["Requirements", "architecture", "scalability", "failure handling"],
        "domain_deep_dive_focus": ["Role-specific tradeoffs"],
        "behavioral_focus": ["Ownership", "communication and collaboration"],
        "custom_system_design_questions": [{
            "title": "Design a core system for this role's product area",
            "difficulty": "medium",
            "why_relevant": "Covers the JD's system design and engineering expectations.",
            "expected_topics": ["API", "data model", "cache", "queue", "scalability"],
        }],
        "scoring_focus": ["System design fundamentals", "role-relevant technical tradeoffs"],
    }

async def analyze_jd(company_name: str | None, role_title: str | None, job_description: str, interview_language: str) -> dict:
    output_language = "Chinese" if interview_language == "zh" else "English"
    prompt = (
        "Extract a structured interview profile from this job description.\n"
        "Return ONLY valid JSON. No markdown.\n"
        f"Use {output_language} for user-visible arrays and summaries.\n\n"
        "Rules:\n"
        "- Infer company_name and role_title from the JD if not provided.\n"
        "- seniority must be intern, new_grad, junior, mid, or unknown.\n"
        "- domain must be backend, frontend, fullstack, fintech, payments, infra, cloud, devops, data, ml_ai, security, mobile, or general.\n"
        "- tech_stack must be a flat array. If vague, produce a generic profile.\n\n"
        "Return JSON with company_name, role_title, seniority, domain, tech_stack, responsibilities, required_skills, and interview_focus.\n\n"
        f"Provided company_name: {company_name or ''}\n"
        f"Provided role_title: {role_title or ''}\n"
        f"JD:\n{job_description}"
    )
    try:
        response = await client.chat.completions.create(
            model="deepseek-chat",
            max_tokens=1800,
            messages=[{"role": "user", "content": prompt}],
        )
        profile = _extract_json_object(response.choices[0].message.content)
    except Exception:
        profile = _fallback_profile(company_name, role_title, interview_language)

    profile["company_name"] = profile.get("company_name") or company_name
    profile["role_title"] = profile.get("role_title") or role_title
    profile["tech_stack"] = _safe_list(profile.get("tech_stack"))
    profile["responsibilities"] = _safe_list(profile.get("responsibilities"))
    profile["required_skills"] = _safe_list(profile.get("required_skills"))
    profile["interview_focus"] = _safe_list(profile.get("interview_focus"))
    return profile


async def generate_blueprint(profile: dict, interview_language: str) -> dict:
    output_language = "Chinese" if interview_language == "zh" else "English"
    prompt = (
        "Generate an interview blueprint from this JD profile.\n"
        "Return ONLY valid JSON. No markdown.\n"
        f"Use {output_language} for all user-visible content.\n\n"
        "For this version, make custom_system_design_questions startable and concrete.\n"
        "Return JSON with summary, coding_focus, cs_fundamentals_focus, system_design_focus, "
        "domain_deep_dive_focus, behavioral_focus, custom_system_design_questions, and scoring_focus.\n\n"
        f"Profile:\n{_json_dumps(profile)}"
    )
    try:
        response = await client.chat.completions.create(
            model="deepseek-chat",
            max_tokens=2400,
            messages=[{"role": "user", "content": prompt}],
        )
        blueprint = _extract_json_object(response.choices[0].message.content)
    except Exception:
        blueprint = _fallback_blueprint(interview_language)

    for key in [
        "coding_focus",
        "cs_fundamentals_focus",
        "system_design_focus",
        "domain_deep_dive_focus",
        "behavioral_focus",
        "custom_system_design_questions",
        "scoring_focus",
    ]:
        blueprint[key] = _safe_list(blueprint.get(key))
    return blueprint


def _fallback_parsed_job(company_name: str | None, role_title: str | None, location: str | None, language: str) -> dict:
    return {
        "company_name": company_name,
        "role_title": role_title,
        "location": location,
        "employment_type": "unknown",
        "term": "unknown",
        "domain": "general",
        "tech_stack": {
            "languages": [],
            "frontend": [],
            "backend": [],
            "databases": [],
            "cloud_devops": [],
            "ai_tools": [],
            "testing": [],
            "other": [],
        },
        "responsibilities": [],
        "required_skills": [],
        "nice_to_have": [],
        "application_requirements": [],
        "deadline": None,
        "work_authorization_signals": [],
        "ats_or_platform": "unknown",
        "summary": "Needs pasted JD before reliable parsing." if language == "en" else "需要粘贴 JD 后才能可靠解析。",
        "risk_flags": ["Needs JD"] if language == "en" else ["需要 JD"],
    }

def _normalize_parsed_job(parsed: dict, company_name: str | None, role_title: str | None, location: str | None, language: str) -> dict:
    fallback = _fallback_parsed_job(company_name, role_title, location, language)
    for key, value in fallback.items():
        parsed.setdefault(key, value)
    parsed["company_name"] = parsed.get("company_name") or company_name
    parsed["role_title"] = parsed.get("role_title") or role_title
    parsed["location"] = parsed.get("location") or location
    parsed["tech_stack"] = parsed.get("tech_stack") if isinstance(parsed.get("tech_stack"), dict) else fallback["tech_stack"]
    for key in fallback["tech_stack"]:
        parsed["tech_stack"].setdefault(key, [])
        if not isinstance(parsed["tech_stack"][key], list):
            parsed["tech_stack"][key] = []
    for key in [
        "responsibilities",
        "required_skills",
        "nice_to_have",
        "application_requirements",
        "work_authorization_signals",
        "risk_flags",
    ]:
        parsed[key] = _safe_list(parsed.get(key))
    return parsed


async def parse_career_job(
    raw_job_description: str,
    company_name: str | None,
    role_title: str | None,
    location: str | None,
    candidate_profile: dict | None,
    interview_language: str,
) -> dict:
    if not raw_job_description.strip():
        return _fallback_parsed_job(company_name, role_title, location, interview_language)

    output_language = "Chinese" if interview_language == "zh" else "English"
    prompt = (
        "Parse this internship or early-career job posting.\n"
        "Return ONLY strict JSON. No markdown.\n"
        f"Use {output_language} for summary and list content.\n\n"
        "Rules:\n"
        "- Extract facts from the JD when present.\n"
        "- Infer cautiously only when strongly implied. Use unknown when unsure.\n"
        "- Do not invent deadlines or provide immigration/legal advice.\n"
        "- employment_type must be internship, co-op, new_grad, full_time, or unknown.\n"
        "- domain must be backend, frontend, fullstack, fintech, payments, infra, cloud, devops, data, ml_ai, security, mobile, or general.\n"
        "- ats_or_platform must be greenhouse, lever, workday, linkedin, indeed, company_site, or unknown.\n\n"
        "Return JSON with company_name, role_title, location, employment_type, term, domain, tech_stack, "
        "responsibilities, required_skills, nice_to_have, application_requirements, deadline, "
        "work_authorization_signals, ats_or_platform, summary, and risk_flags.\n\n"
        f"Optional candidate profile context:\n{_json_dumps(candidate_profile or {})}\n\n"
        f"Provided company_name: {company_name or ''}\n"
        f"Provided role_title: {role_title or ''}\n"
        f"Provided location: {location or ''}\n\n"
        f"Job description:\n{raw_job_description}"
    )
    try:
        response = await client.chat.completions.create(
            model="deepseek-chat",
            max_tokens=2200,
            messages=[{"role": "user", "content": prompt}],
        )
        parsed = _extract_json_object(response.choices[0].message.content)
    except Exception:
        parsed = _fallback_parsed_job(company_name, role_title, location, interview_language)
    return _normalize_parsed_job(parsed, company_name, role_title, location, interview_language)


def _fallback_fit_score(language: str) -> dict:
    if language == "zh":
        return {
            "overall_score": 0,
            "priority": "unknown",
            "summary": "需要候选人资料和已解析 JD 后才能生成可靠匹配度。",
            "breakdown": {
                "role_match": 0,
                "tech_stack_match": 0,
                "location_match": 0,
                "experience_level_match": 0,
                "project_relevance": 0,
                "application_risk": 0,
            },
            "matched_strengths": [],
            "gaps": ["信息不足"],
            "recommended_resume_keywords": [],
            "recommended_projects_to_highlight": [],
            "next_action": "needs_more_info",
        }
    return {
        "overall_score": 0,
        "priority": "unknown",
        "summary": "Add a candidate profile and parsed JD before generating a reliable fit score.",
        "breakdown": {
            "role_match": 0,
            "tech_stack_match": 0,
            "location_match": 0,
            "experience_level_match": 0,
            "project_relevance": 0,
            "application_risk": 0,
        },
        "matched_strengths": [],
        "gaps": ["Insufficient information"],
        "recommended_resume_keywords": [],
        "recommended_projects_to_highlight": [],
        "next_action": "needs_more_info",
    }

def _normalize_fit_score(score: dict, language: str) -> dict:
    fallback = _fallback_fit_score(language)
    for key, value in fallback.items():
        score.setdefault(key, value)
    try:
        score["overall_score"] = max(0, min(100, int(score.get("overall_score", 0))))
    except (TypeError, ValueError):
        score["overall_score"] = 0
    score["priority"] = score.get("priority") if score.get("priority") in ["high", "medium", "low", "unknown"] else "unknown"
    score["next_action"] = score.get("next_action") if score.get("next_action") in [
        "apply_now",
        "tailor_resume",
        "research_company",
        "skip",
        "needs_more_info",
    ] else "needs_more_info"
    breakdown = score.get("breakdown") if isinstance(score.get("breakdown"), dict) else {}
    for key in fallback["breakdown"]:
        try:
            breakdown[key] = max(0, min(100, int(breakdown.get(key, 0))))
        except (TypeError, ValueError):
            breakdown[key] = 0
    score["breakdown"] = breakdown
    for key in [
        "matched_strengths",
        "gaps",
        "recommended_resume_keywords",
        "recommended_projects_to_highlight",
    ]:
        score[key] = _safe_list(score.get(key))
    return score


async def score_career_job(parsed_job: dict, candidate_profile: dict, interview_language: str) -> dict:
    if not parsed_job or not candidate_profile:
        return _fallback_fit_score(interview_language)

    output_language = "Chinese" if interview_language == "zh" else "English"
    prompt = (
        "Compare this parsed job against the candidate profile and produce a practical internship fit score.\n"
        "Return ONLY strict JSON. No markdown.\n"
        f"Use {output_language} for all user-visible content.\n\n"
        "Rules:\n"
        "- High score does not guarantee an interview.\n"
        "- Low score does not automatically mean skip.\n"
        "- Be conservative and practical.\n"
        "- Penalize unclear seniority mismatch and obvious full-time roles if internships are targeted.\n"
        "- Reward strong project, tech, location, and remote compatibility.\n"
        "- Surface work authorization uncertainty as a risk flag, not legal advice.\n\n"
        "Return JSON with overall_score, priority, summary, breakdown, matched_strengths, gaps, "
        "recommended_resume_keywords, recommended_projects_to_highlight, and next_action.\n\n"
        f"Parsed job:\n{_json_dumps(parsed_job)}\n\n"
        f"Candidate profile:\n{_json_dumps(candidate_profile)}"
    )
    try:
        response = await client.chat.completions.create(
            model="deepseek-chat",
            max_tokens=2200,
            messages=[{"role": "user", "content": prompt}],
        )
        score = _extract_json_object(response.choices[0].message.content)
    except Exception:
        score = _fallback_fit_score(interview_language)
    return _normalize_fit_score(score, interview_language)


def _fallback_resume_analysis(language: str) -> dict:
    message = "无法完整分析简历；请检查内容后手动编辑候选人资料。" if language == "zh" else "Could not fully analyze the resume. Review the content and edit the candidate profile manually."
    return {
        "resume_profile": {"name": "", "education": {}, "target_roles": [], "target_locations": [], "skills": {"languages": [], "frontend": [], "backend": [], "databases": [], "cloud_devops": [], "ai_tools": [], "testing": [], "other": []}, "projects": [], "experience": [], "preferred_domains": [], "search_keywords": [], "suggested_job_titles": [], "strengths": [], "gaps": [message]},
        "recommended_search_queries": [],
        "profile_summary": message,
    }


async def analyze_resume(resume_text: str, output_language: str) -> dict:
    language_name = "Chinese" if output_language == "zh" else "English"
    prompt = f"""Extract a conservative candidate profile from this resume. Return ONLY strict JSON.
Return all user-facing explanation fields in {language_name}. Keep company names, role titles, programming languages, protocols, frameworks, and technical terms such as API, Python, React, BGP, OSPF, Kubernetes, SQL in their original form when appropriate.
Do not invent locations, work authorization, experience level, or skills. Infer multiple role targets only when the resume supports them.
JSON schema: {{"resume_profile":{{"name":"","education":{{"school":"","degree":"","major":"","year_level":"","graduation_year":""}},"target_roles":[],"target_locations":[],"skills":{{"languages":[],"frontend":[],"backend":[],"databases":[],"cloud_devops":[],"ai_tools":[],"testing":[],"other":[]}},"projects":[{{"name":"","description":"","tech_stack":[],"relevance_tags":[]}}],"experience":[{{"company":"","role":"","summary":"","tech_stack":[],"relevance_tags":[]}}],"preferred_domains":[],"search_keywords":[],"suggested_job_titles":[],"strengths":[],"gaps":[]}},"recommended_search_queries":[{{"label":"","query":"","why":""}}],"profile_summary":""}}
Resume text:\n{resume_text[:60000]}"""
    try:
        response = await client.chat.completions.create(model="deepseek-chat", max_tokens=4000, messages=[{"role": "user", "content": prompt}])
        result = _extract_json_object(response.choices[0].message.content)
    except Exception:
        return _fallback_resume_analysis(output_language)
    fallback = _fallback_resume_analysis(output_language)
    profile = result.get("resume_profile") if isinstance(result.get("resume_profile"), dict) else {}
    fallback_profile = fallback["resume_profile"]
    skills = profile.get("skills") if isinstance(profile.get("skills"), dict) else {}
    for key in fallback_profile["skills"]:
        skills[key] = _safe_list(skills.get(key))
    profile["skills"] = skills
    profile["education"] = profile.get("education") if isinstance(profile.get("education"), dict) else {}
    for key in ["target_roles", "target_locations", "projects", "experience", "preferred_domains", "search_keywords", "suggested_job_titles", "strengths", "gaps"]:
        profile[key] = _safe_list(profile.get(key))
    return {"resume_profile": profile, "recommended_search_queries": _safe_list(result.get("recommended_search_queries"))[:12], "profile_summary": _safe_str(result.get("profile_summary")) or fallback["profile_summary"]}


def generate_job_search_plan(request: dict) -> dict:
    role = _safe_str(request.get("target_role")) or "Software Engineer Intern"
    locations = [_safe_str(item) for item in _safe_list(request.get("locations")) if _safe_str(item)]
    term = _safe_str(request.get("term"))
    domain = _safe_str(request.get("domain"))
    keywords = [_safe_str(item) for item in _safe_list(request.get("keywords")) if _safe_str(item)]
    sources = _safe_list(request.get("sources")) or ["Google", "Company Careers", "Greenhouse", "Lever", "Manual Paste"]
    remote = _safe_str(request.get("remote_preference")) or "any"
    level = _safe_str(request.get("experience_level")) or "intern"
    language = request.get("language") if request.get("language") in ["en", "zh"] else "en"

    location_phrase = " ".join(locations) if locations else "Canada"
    primary_location = locations[0] if locations else "Canada"
    term_part = f' "{term}"' if term else ""
    keyword_part = " ".join(f'"{kw}"' for kw in keywords[:5])
    level_terms = {
        "intern": "intern internship",
        "co-op": "co-op internship",
        "new_grad": "new grad",
        "any": "intern co-op new grad",
    }.get(level, "intern internship")
    remote_part = "" if remote == "any" else f' "{remote}"'

    templates = [
        ("Google", f'"{role}" "{primary_location}"{term_part} {level_terms} {keyword_part}'.strip(), "Broad search across public job pages."),
        ("Greenhouse", f'site:greenhouse.io "{role}" "{location_phrase}"{term_part}'.strip(), "Find public Greenhouse-hosted postings."),
        ("Lever", f'site:lever.co "{role}" "{location_phrase}"{term_part}'.strip(), "Find public Lever-hosted postings."),
        ("Company Careers", f'"{role}" "{primary_location}" "careers"{term_part} {keyword_part}'.strip(), "Find company career pages that may not be indexed by job boards."),
        ("Wellfound", f'"{role}" startup "{primary_location}"{term_part}'.strip(), "Check startup internships manually from public result pages."),
        ("Job Bank", f'"{role}" "Job Bank" "{primary_location}"'.strip(), "Check public Canadian Job Bank pages where available."),
        ("University Career Portal", f'"{role}" "{primary_location}" "co-op"{term_part}'.strip(), "Use this as a prompt for university portals you can access manually."),
    ]
    if remote != "any":
        templates.insert(1, ("Google", f'"{role}" "{location_phrase}"{remote_part}{term_part} {level_terms}'.strip(), "Target roles matching the remote or onsite preference."))
    if domain:
        templates.append(("Google", f'"{role}" "{primary_location}" "{domain}"{term_part} {keyword_part}'.strip(), "Narrow public results by domain and skills."))

    selected = set(str(source) for source in sources)
    include_google = "Google" in selected
    recommended = []
    seen = set()
    for source, query, why in templates:
        if source != "Google" and source not in selected and source not in ["Greenhouse", "Lever"]:
            continue
        if source == "Google" and not include_google:
            continue
        key = (source, query.lower())
        if key in seen:
            continue
        seen.add(key)
        recommended.append({
            "source": source,
            "query": query,
            "url": f"https://www.google.com/search?q={query.replace(' ', '+')}",
            "why": why if language == "en" else "用于打开公开搜索结果；结果需要人工核对。",
        })

    if language == "zh":
        summary = f"围绕 {role} 在 {location_phrase} 的机会生成公开搜索计划。结果不是完整覆盖，请手动核对岗位真实性和申请要求。"
        manual_steps = [
            "打开搜索链接并人工筛选公开岗位。",
            "从 LinkedIn、Indeed、Glassdoor 等平台复制可见结果文本，不要让系统登录或抓取。",
            "把搜索摘要或公开页面文本粘贴到导入区提取线索。",
            "保存前检查重复项、URL 和是否需要补充 JD。",
        ]
        source_strategy = [
            {"source": "Company Careers", "instructions": "优先查看公司官网 careers 页面和学生项目页面。"},
            {"source": "Greenhouse / Lever", "instructions": "只打开公开岗位页面；如果无法访问，请手动粘贴文本。"},
            {"source": "Manual Paste", "instructions": "对登录后平台，仅复制你能看到的文本进行整理。"},
        ]
    else:
        summary = f"Public-search plan for {role} around {location_phrase}. Treat this as a guided search, not an exhaustive crawler."
        manual_steps = [
            "Open the search links and manually review public results.",
            "For LinkedIn, Indeed, Glassdoor, or private portals, copy visible text yourself instead of scraping.",
            "Paste result snippets or public page text into Import Search Results.",
            "Review duplicates, URLs, and Needs JD flags before saving leads.",
        ]
        source_strategy = [
            {"source": "Company Careers", "instructions": "Prioritize company careers pages and student program pages for fresher postings."},
            {"source": "Greenhouse / Lever", "instructions": "Open only public posting pages. If fetch fails, paste the text manually."},
            {"source": "Manual Paste", "instructions": "Use copied text from platforms that require a logged-in or interactive session."},
        ]

    return {
        "search_summary": summary,
        "recommended_queries": recommended[:12],
        "source_strategy": source_strategy,
        "manual_steps": manual_steps,
    }


def _normalize_job_lead(lead: dict, source_hint: str | None = None) -> dict:
    confidence = lead.get("confidence", 0)
    try:
        confidence = max(0, min(100, int(confidence)))
    except (TypeError, ValueError):
        confidence = 0
    return {
        "company_name": _safe_str(lead.get("company_name")) or None,
        "role_title": _safe_str(lead.get("role_title")) or None,
        "location": _safe_str(lead.get("location")) or None,
        "source": _safe_str(lead.get("source")) or source_hint or "Manual",
        "job_url": _safe_str(lead.get("job_url")) or None,
        "application_url": _safe_str(lead.get("application_url")) or None,
        "snippet": _safe_str(lead.get("snippet"))[:4000] or None,
        "confidence": confidence,
        "needs_jd": bool(lead.get("needs_jd", True)),
        "reason": _safe_str(lead.get("reason")) or "Extracted from pasted text.",
    }


def _fallback_extract_job_leads(pasted_text: str, source_hint: str | None, language: str) -> dict:
    lines = [line.strip() for line in pasted_text.splitlines() if line.strip()]
    leads = []
    ignored = []
    role_markers = ["intern", "internship", "co-op", "coop", "new grad", "software", "developer", "engineer", "backend", "frontend", "full-stack", "fullstack", "ai", "ml", "data"]
    url = None
    for idx, line in enumerate(lines):
        if line.startswith("http://") or line.startswith("https://"):
            url = line
            continue
        lower = line.lower()
        if not any(marker in lower for marker in role_markers):
            if len(ignored) < 12:
                ignored.append({"text": line[:160], "reason": "No role signal"})
            continue
        company = None
        title = line
        for sep in [" - ", " | ", " at ", " @ "]:
            if sep in line:
                parts = line.split(sep, 1)
                title, company = parts[0], parts[1]
                break
        snippet = " ".join(lines[idx:idx + 3])[:700]
        leads.append(_normalize_job_lead({
            "company_name": company,
            "role_title": title[:180],
            "location": None,
            "source": source_hint or "Manual",
            "job_url": url,
            "application_url": url,
            "snippet": snippet,
            "confidence": 45,
            "needs_jd": True,
            "reason": "Fallback extraction from role-like text." if language == "en" else "从疑似岗位文本中进行兜底提取。",
        }, source_hint))
        url = None
        if len(leads) >= 20:
            break
    return {"job_leads": leads, "ignored_items": ignored}


async def analyze_pasted_job_page(
    pasted_page_text: str,
    source_hint: str | None,
    job_url: str | None,
    application_url: str | None,
    candidate_profile: dict | None,
    language: str,
) -> dict:
    """
    Analyze a full pasted job page text.
    Returns is_job_posting, confidence, extracted_job, fit, cleaned_jd_text, ignored_noise.
    """
    text = pasted_page_text.strip()
    if not text:
        return {
            "is_job_posting": False,
            "confidence": 0,
            "reason": "Empty text provided." if language == "en" else "未提供文本。",
            "possible_next_steps": ["Paste the full job posting page text."] if language == "en" else ["请粘贴完整的岗位页面文本。"],
        }

    output_language = "Chinese" if language == "zh" else "English"
    profile_json = _json_dumps(candidate_profile or {})

    prompt = f"""You are a precise job posting parser. Analyze the following pasted page text and:
1. Determine if it is a real job posting (not a generic company page, not a blog, not navigation-only).
2. If it is a job posting, extract all structured fields.
3. Evaluate fit against the candidate profile.

Return ONLY strict JSON. No markdown, no preamble, no explanation.
Use {output_language} for all user-visible text (summaries, reasons, bullet points).
Keep technical terms (API, Python, BGP, Kubernetes, etc.) as-is in all languages.

=== NOISE REMOVAL RULES ===
- Remove: page navigation, cookie banners, footers, company marketing slogans, social media links, repeated boilerplate, unrelated sections.
- Keep: role title, company name, location, requirements, responsibilities, salary, deadline, application instructions, tech stack mentions.

=== EXTRACTION RULES ===
- experience_level: must be one of: intern, co-op, new_grad, junior, mid, senior, experienced, unknown
  - Use "experienced" if the role explicitly requires 5+ years or is clearly not entry-level/internship
  - Use "intern" or "co-op" only if the posting explicitly uses those terms
- employment_type: must be one of: internship, co-op, new_grad, full_time, contract, unknown
- domain: must be one of: backend, frontend, fullstack, fintech, payments, infra, cloud, devops, data, ml_ai, security, network, mobile, general
- Do NOT invent deadlines, salary, or URLs not present in the text
- Use null or empty array when information is absent
- For risk_flags, check: experienced role, seniority mismatch, not internship, location mismatch, work authorization unclear, missing JD body, no application link, unrelated role

=== FIT DECISION RULES ===
Compare extracted job against candidate profile:
- "apply": strong match on role type, level, location, and core skills
- "maybe": partial match, worth considering despite some gaps
- "skip": obvious mismatch (e.g., experienced role requiring 5+ years when candidate targets internships; unrelated domain)
- "needs_more_info": JD text is too sparse to evaluate reliably

=== OUTPUT SCHEMA ===
If IS a job posting, return:
{{
  "is_job_posting": true,
  "confidence": <0-100>,
  "extracted_job": {{
    "company_name": <string|null>,
    "role_title": <string|null>,
    "location": <string|null>,
    "experience_level": <"intern"|"co-op"|"new_grad"|"junior"|"mid"|"senior"|"experienced"|"unknown">,
    "employment_type": <"internship"|"co-op"|"new_grad"|"full_time"|"contract"|"unknown">,
    "term": <string|null>,
    "domain": <"backend"|"frontend"|"fullstack"|"fintech"|"payments"|"infra"|"cloud"|"devops"|"data"|"ml_ai"|"security"|"network"|"mobile"|"general">,
    "source": <string|null>,
    "job_url": <string|null>,
    "application_url": <string|null>,
    "salary_range": <string|null>,
    "deadline": <string|null>,
    "application_checklist": <array of strings>,
    "tech_stack": {{
      "languages": [],
      "frontend": [],
      "backend": [],
      "databases": [],
      "cloud_devops": [],
      "networking": [],
      "ai_tools": [],
      "testing": [],
      "other": []
    }},
    "responsibilities": <array of strings>,
    "requirements": <array of strings>,
    "nice_to_have": <array of strings>,
    "risk_flags": <array of strings>,
    "summary": <string>
  }},
  "fit": {{
    "overall_score": <0-100>,
    "decision": <"apply"|"maybe"|"skip"|"needs_more_info">,
    "priority": <"high"|"medium"|"low">,
    "summary": <string>,
    "main_reason": <string>,
    "breakdown": {{
      "role_match": <0-100>,
      "tech_stack_match": <0-100>,
      "location_match": <0-100>,
      "experience_level_match": <0-100>,
      "project_relevance": <0-100>,
      "application_risk": <0-100>
    }},
    "matched_strengths": <array of strings>,
    "gaps": <array of strings>,
    "risk_flags": <array of strings>,
    "recommended_resume_keywords": <array of strings>,
    "recommended_projects_to_highlight": <array of strings>,
    "next_action": <"apply_now"|"tailor_resume"|"research_company"|"skip"|"needs_more_info">
  }},
  "cleaned_jd_text": <string — clean job description body, noise removed>,
  "ignored_noise": <array of short strings describing what was removed>
}}

If NOT a job posting, return:
{{
  "is_job_posting": false,
  "confidence": <0-100>,
  "reason": <string explaining what this page appears to be>,
  "possible_next_steps": <array of strings>
}}

=== INPUTS ===
Source hint: {source_hint or "unknown"}
Job URL hint: {job_url or ""}
Application URL hint: {application_url or ""}
Candidate profile: {profile_json}

Pasted page text (may contain noise):
{text[:25000]}
"""

    try:
        response = await client.chat.completions.create(
            model="deepseek-chat",
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.choices[0].message.content
        result = _extract_json_object(raw)
    except Exception as exc:
        # Robust fallback
        return {
            "is_job_posting": False,
            "confidence": 0,
            "reason": f"Analysis failed: {exc}" if language == "en" else f"分析失败：{exc}",
            "possible_next_steps": [
                "Try again with a shorter or cleaner paste.",
                "Manually fill in the job details using Add Job.",
            ] if language == "en" else [
                "请尝试粘贴更短或更干净的文本。",
                "也可以通过【添加岗位】手动填写岗位信息。",
            ],
        }

    # Normalize result
    if not result.get("is_job_posting"):
        return {
            "is_job_posting": False,
            "confidence": max(0, min(100, int(result.get("confidence", 0)))),
            "reason": _safe_str(result.get("reason")) or ("Does not appear to be a job posting." if language == "en" else "看起来不是一个岗位页面。"),
            "possible_next_steps": _safe_list(result.get("possible_next_steps")),
        }

    extracted = result.get("extracted_job") or {}
    fit = result.get("fit") or {}

    # Normalize extracted_job
    tech_stack_fallback = {"languages": [], "frontend": [], "backend": [], "databases": [], "cloud_devops": [], "networking": [], "ai_tools": [], "testing": [], "other": []}
    ts = extracted.get("tech_stack") if isinstance(extracted.get("tech_stack"), dict) else {}
    for k in tech_stack_fallback:
        ts.setdefault(k, [])
        if not isinstance(ts[k], list):
            ts[k] = []
    extracted["tech_stack"] = ts
    extracted["job_url"] = extracted.get("job_url") or job_url
    extracted["application_url"] = extracted.get("application_url") or application_url
    extracted["source"] = extracted.get("source") or source_hint or "Pasted Page"
    for key in ["responsibilities", "requirements", "nice_to_have", "application_checklist", "risk_flags"]:
        extracted[key] = _safe_list(extracted.get(key))

    # Normalize fit
    valid_decisions = {"apply", "maybe", "skip", "needs_more_info"}
    valid_next_actions = {"apply_now", "tailor_resume", "research_company", "skip", "needs_more_info"}
    fit["decision"] = fit.get("decision") if fit.get("decision") in valid_decisions else "needs_more_info"
    fit["priority"] = fit.get("priority") if fit.get("priority") in {"high", "medium", "low"} else "low"
    fit["next_action"] = fit.get("next_action") if fit.get("next_action") in valid_next_actions else "needs_more_info"
    try:
        fit["overall_score"] = max(0, min(100, int(fit.get("overall_score", 0))))
    except (TypeError, ValueError):
        fit["overall_score"] = 0
    breakdown = fit.get("breakdown") if isinstance(fit.get("breakdown"), dict) else {}
    for k in ["role_match", "tech_stack_match", "location_match", "experience_level_match", "project_relevance", "application_risk"]:
        try:
            breakdown[k] = max(0, min(100, int(breakdown.get(k, 0))))
        except (TypeError, ValueError):
            breakdown[k] = 0
    fit["breakdown"] = breakdown
    for key in ["matched_strengths", "gaps", "risk_flags", "recommended_resume_keywords", "recommended_projects_to_highlight"]:
        fit[key] = _safe_list(fit.get(key))

    return {
        "is_job_posting": True,
        "confidence": max(0, min(100, int(result.get("confidence", 80)))),
        "extracted_job": extracted,
        "fit": fit,
        "cleaned_jd_text": _safe_str(result.get("cleaned_jd_text")) or text[:10000],
        "ignored_noise": _safe_list(result.get("ignored_noise")),
    }


async def extract_job_leads(pasted_text: str, source_hint: str | None, target_role: str | None, locations: list[str] | None, language: str) -> dict:
    text = pasted_text.strip()
    if not text:
        return {"job_leads": [], "ignored_items": []}
    output_language = "Chinese" if language == "zh" else "English"
    prompt = (
        "Extract plausible internship or early-career job leads from pasted search result or public page text.\n"
        "Return ONLY strict JSON. No markdown.\n"
        f"Use {output_language} for reason fields.\n\n"
        "Rules:\n"
        "- Extract only plausible job postings.\n"
        "- Ignore ads, navigation, repeated boilerplate, unrelated pages, and generic company pages.\n"
        "- Do not invent URLs, deadlines, companies, or application links.\n"
        "- If URL is unavailable, use null.\n"
        "- If a full job description is not present, set needs_jd true.\n"
        "- confidence is 0-100 based on how clearly this is a job posting.\n\n"
        "Return JSON with this shape: job_leads is an array of objects with company_name, role_title, "
        "location, source, job_url, application_url, snippet, confidence, needs_jd, reason; "
        "ignored_items is an array of objects with text and reason.\n\n"
        f"Source hint: {source_hint or 'unknown'}\n"
        f"Target role: {target_role or ''}\n"
        f"Target locations: {_json_dumps(locations or [])}\n\n"
        f"Text:\n{text[:18000]}"
    )
    try:
        response = await client.chat.completions.create(
            model="deepseek-chat",
            max_tokens=3200,
            messages=[{"role": "user", "content": prompt}],
        )
        parsed = _extract_json_object(response.choices[0].message.content)
        leads = [_normalize_job_lead(lead, source_hint) for lead in _safe_list(parsed.get("job_leads"))]
        ignored = _safe_list(parsed.get("ignored_items"))
        return {"job_leads": leads, "ignored_items": ignored[:30]}
    except Exception:
        return _fallback_extract_job_leads(text, source_hint, language)
