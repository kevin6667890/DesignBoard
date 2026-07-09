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

你的风格:
- 简洁、专业、有评估感。不热情寒暄，也不带攻击性。
- 每次只问一个聚焦问题。不要一次抛出多个问题。
- 面试中每次回复控制在 2-4 句，不讲课。
- 不暗示正确答案，不辅导候选人。
- 如果回答含糊，要追问: "具体是什么意思？"、"在大规模下这怎么成立？"
- 如果回答薄弱，要追问故障、扩展性或一致性问题。
- 如果回答较强，马上提高难度，进入更深的子问题。

自然覆盖这些方向，但不要一次性全部问完:
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


def _build_opening_message(question_title: str, interview_language: str = "en") -> str:
    if interview_language == "zh":
        return (
            f"你好，我是 Alex。今天我们做这道系统设计题: {question_title}。"
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

    return f"""You conducted a system design interview. Here is the full transcript:

{transcript}

{language_instruction}
{jd_instruction}
Evaluate the candidate on exactly these 5 dimensions, score each 0 to 10:

1. requirements_clarification - Did they ask smart functional and non-functional requirements questions?
2. system_components - Did they identify the right high-level components and explain data flow?
3. scalability - Did they address bottlenecks, caching, sharding, failure modes?
4. data_modeling - Did they choose appropriate databases and justify their choices?
5. communication - Were they clear, structured, and able to think out loud coherently?

Also provide:
- missed_points: A list of exactly 3-5 specific things the candidate failed to cover or got wrong.
- summary: 2-3 sentences of overall assessment. Be direct.

Respond ONLY with valid JSON. No markdown, no explanation, no preamble:
{{
  "requirements_clarification": <int 0-10>,
  "system_components": <int 0-10>,
  "scalability": <int 0-10>,
  "data_modeling": <int 0-10>,
  "communication": <int 0-10>,
  "missed_points": ["...", "...", "..."],
  "summary": "..."{role_fit_schema}
}}"""


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
        "interview_focus": ["system design fundamentals"] if language == "en" else ["系统设计基础"],
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
    prompt = f"""Extract a structured interview profile from this job description.
Return ONLY valid JSON. No markdown.
Use {output_language} for user-visible arrays and summaries.

Rules:
- Infer company_name from the JD if not provided.
- Infer role_title from the JD if not provided.
- seniority must be one of: intern, new_grad, junior, mid, unknown.
- domain must be one of: backend, frontend, fullstack, fintech, payments, infra, cloud, devops, data, ml_ai, security, mobile, general.
- tech_stack must be a flat array including languages, frameworks, databases, cloud, and tools.
- If the JD is vague, produce a reasonable generic profile. Do not fail.

Provided company_name: {company_name or ""}
Provided role_title: {role_title or ""}
JD:
{job_description}

JSON schema:
{{
  "company_name": string | null,
  "role_title": string | null,
  "seniority": "intern" | "new_grad" | "junior" | "mid" | "unknown",
  "domain": "backend" | "frontend" | "fullstack" | "fintech" | "payments" | "infra" | "cloud" | "devops" | "data" | "ml_ai" | "security" | "mobile" | "general",
  "tech_stack": string[],
  "responsibilities": string[],
  "required_skills": string[],
  "interview_focus": string[]
}}"""
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
    prompt = f"""Generate an interview blueprint from this JD profile.
Return ONLY valid JSON. No markdown.
Use {output_language} for all user-visible content.

For this version, make custom_system_design_questions startable and concrete.
Other round sections are future planning.
Question examples by domain:
- observability/platform: metrics ingestion, alerting, log pipelines, high-throughput event processing
- fintech/payments: payment system, ledger, fraud detection, reconciliation, idempotency, audit logs
- frontend/fullstack: dashboard architecture, realtime collaboration, API design, state management, performance, accessibility

Profile:
{_json_dumps(profile)}

JSON schema:
{{
  "summary": string,
  "coding_focus": string[],
  "cs_fundamentals_focus": string[],
  "system_design_focus": string[],
  "domain_deep_dive_focus": string[],
  "behavioral_focus": string[],
  "custom_system_design_questions": [
    {{
      "title": string,
      "difficulty": "easy" | "medium" | "hard",
      "why_relevant": string,
      "expected_topics": string[]
    }}
  ],
  "scoring_focus": string[]
}}"""
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
