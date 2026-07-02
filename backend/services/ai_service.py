import os
import json
from typing import AsyncGenerator
from dotenv import load_dotenv
from openai import AsyncOpenAI

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

client = AsyncOpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com",
)

INTERVIEWER_SYSTEM_PROMPT = """You are Alex, a senior software engineer at a FAANG-level tech company conducting a system design interview.

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
1. Requirements clarification — functional vs non-functional, scale assumptions
2. Capacity estimation — QPS, storage, bandwidth
3. High-level architecture — components, services, data flow
4. Data modeling — schema design, SQL vs NoSQL with real reasoning
5. API design — endpoints, request/response contracts
6. Scalability — caching strategy, sharding, CDN, load balancing, queues
7. Failure modes — what breaks, how to detect it, how to recover"""


def _build_opening_message(question_title: str) -> str:
    return (
        f"Hi, I'm Alex. Today we're going to work on: {question_title}. "
        "You have 45 minutes. I want you to think out loud as you go. "
        "To start — what clarifying questions do you have about the requirements?"
    )


EMOTION_CONTEXT = {
    "nervous": "The candidate appears nervous. Ask a clearer, more grounded follow-up and reduce ambiguity slightly.",
    "confused": "The candidate appears confused. Reframe the question without giving away the answer.",
    "confident": "The candidate appears confident. Increase difficulty and ask deeper scalability or failure-mode questions.",
    "focused": "The candidate appears focused. Continue normally.",
}


def _build_conversation_messages(history: list[dict], emotion_label: str | None = None) -> list[dict]:
    messages = [{"role": "system", "content": INTERVIEWER_SYSTEM_PROMPT}]
    emotion_instruction = EMOTION_CONTEXT.get(emotion_label or "")
    if emotion_instruction:
        messages.append({"role": "system", "content": f"[Candidate state: {emotion_instruction}]"})
    for msg in history:
        role = "assistant" if msg["role"] == "interviewer" else "user"
        messages.append({"role": role, "content": msg["content"]})
    return messages


def _build_evaluation_prompt(transcript: str) -> str:
    return f"""You conducted a system design interview. Here is the full transcript:

{transcript}

Evaluate the candidate on exactly these 5 dimensions, score each 0 to 10:

1. requirements_clarification — Did they ask smart functional and non-functional requirements questions?
2. system_components — Did they identify the right high-level components and explain data flow?
3. scalability — Did they address bottlenecks, caching, sharding, failure modes?
4. data_modeling — Did they choose appropriate databases and justify their choices?
5. communication — Were they clear, structured, and able to think out loud coherently?

Also provide:
- missed_points: A list of exactly 3-5 specific things the candidate failed to cover or got wrong. Be precise (e.g. "Never addressed cache invalidation strategy" not "Could discuss caching more").
- summary: 2-3 sentences of overall assessment. Be direct.

Respond ONLY with valid JSON. No markdown, no explanation, no preamble:
{{
  "requirements_clarification": <int 0-10>,
  "system_components": <int 0-10>,
  "scalability": <int 0-10>,
  "data_modeling": <int 0-10>,
  "communication": <int 0-10>,
  "missed_points": ["...", "...", "..."],
  "summary": "..."
}}"""


async def generate_opening_message(question_title: str) -> str:
    return _build_opening_message(question_title)


async def stream_ai_response(history: list[dict], emotion_label: str | None = None) -> AsyncGenerator[str, None]:
    messages = _build_conversation_messages(history, emotion_label)
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


async def evaluate_session(transcript: str) -> dict:
    response = await client.chat.completions.create(
        model="deepseek-chat",
        max_tokens=2048,
        messages=[{"role": "user", "content": _build_evaluation_prompt(transcript)}],
    )
    text = response.choices[0].message.content
    try:
        start = text.index("{")
        end = text.rindex("}") + 1
        result = json.loads(text[start:end])
    except (ValueError, json.JSONDecodeError):
        raise ValueError(f"Failed to parse evaluation response: {text}")
    return result
