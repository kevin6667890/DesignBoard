# DesignBoard

> AI-powered System Design interview simulator for CS students targeting tech internships.

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)

```
Browser (React/Vite)
       │
       │ /api/* proxy
       ▼
FastAPI Backend ──────► Anthropic Claude API (SSE streaming)
       │
       ▼
  SQLite (sessions + messages)
```

## Features

- **16 Real Interview Questions** — Curated system design prompts across Easy, Medium, and Hard difficulty levels, modeled after actual FAANG interview topics.
- **AI Interviewer ("Alex")** — Claude-powered interviewer that adapts in real time. Probes requirements, capacity estimation, data modeling, scalability, and failure modes. No hand-holding, no coaching.
- **Live Streaming Responses** — Server-Sent Events deliver AI responses character by character, as if Alex is speaking to you in real time.
- **45-Minute Timer** — Industry-standard time limit with color transitions (white → yellow at 10 min → red at 5 min). Auto-ends and evaluates when time runs out.
- **Automated Scorecard** — After each interview, Claude generates a scored evaluation across 5 dimensions (Requirements, Components, Scalability, Data Modeling, Communication) with specific missed points and a summary.
- **Session History** — Review all past interviews with inline scorecard expansion.
- **Dark Theme** — Minimal, low-contrast dark UI with no box-shadows, no gradients, no large rounded corners.

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/designboard.git
cd designboard

# 2. Set up the backend
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
cp .env.example .env      # add your ANTHROPIC_API_KEY to .env
pip install -r requirements.txt

# 3. Set up the frontend
cd ../frontend
npm install

# 4. Start both servers (run in separate terminals)

# Terminal 1 — Backend (port 8000)
cd backend
uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend (port 5173)
cd frontend
npm run dev

# 5. Open http://localhost:5173 in your browser
```

## Technical Decisions

### Why SSE over WebSockets for streaming

Server-Sent Events (SSE) were chosen over WebSockets for the AI response streaming because the communication pattern is fundamentally unidirectional. The client sends a message via a standard POST request, and the server responds with a stream of tokens from the AI model. SSE leverages standard HTTP, works transparently through Vite's dev proxy, and requires no additional connection management libraries. WebSockets would add unnecessary complexity for bidirectional communication that isn't actually needed — the candidate's messages are always discrete request-response cycles, not a persistent bidirectional channel. SSE also plays naturally with FastAPI's `StreamingResponse`, which can consume an async generator and emit `text/event-stream` content without any framework extensions.

### Why SQLite over PostgreSQL

For a local-first demo application, SQLite eliminates all operational overhead. There's no database server to install, no connection pooling to configure, no migrations to run. SQLAlchemy's ORM abstracts the storage layer completely, so migrating to PostgreSQL (or any other dialect) later is a one-line change to the connection string. The concurrency model of SQLite is more than sufficient for a single-user interview simulation — peak traffic is one candidate sending a message and receiving a streamed response. The simplicity gain (zero-ops, zero-config) far outweighs any theoretical scalability benefit from a client-server database in this context.

### How the AI interviewer prompt was engineered

The system prompt for Alex is designed to avoid two common pitfalls in AI interview simulators: excessive helpfulness and generic feedback. By explicitly instructing the model to be "terse, professional, evaluative" and to "ask ONE focused question at a time", the prompt prevents the AI from dumping a checklist of topics or hinting at the right answer. Specific behavioral rules (pressing vague answers, escalating on strong answers, staying silent when the candidate should be talking) create natural interview pressure. The 2-4 sentence response limit forces Alex to react conversationally rather than lecture, simulating the pace of a real system design interview where the interviewer reacts to each statement rather than delivering prepared content.

---

> Demo screenshots coming soon
