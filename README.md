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
FastAPI Backend ──────► DeepSeek API (SSE streaming)
       │
       ▼
  SQLite (sessions + messages)
```

## Features

- **16 Real Interview Questions** — Curated system design prompts across Easy, Medium, and Hard difficulty levels, modeled after actual FAANG interview topics.
- **AI Interviewer ("Alex")** — DeepSeek-powered interviewer that adapts in real time. Probes requirements, capacity estimation, data modeling, scalability, and failure modes. No hand-holding, no coaching.
- **Live Streaming Responses** — Server-Sent Events deliver AI responses character by character, as if Alex is speaking to you in real time.
- **45-Minute Timer** — Industry-standard time limit with color transitions (white → yellow at 10 min → red at 5 min). Auto-ends and evaluates when time runs out.
- **Automated Scorecard** — After each interview, DeepSeek generates a scored evaluation across 5 dimensions (Requirements, Components, Scalability, Data Modeling, Communication) with specific missed points and a summary.
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
cp .env.example .env      # add your DEEPSEEK_API_KEY to .env
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

## v2 Multimodal Interview Room

DesignBoard v2 upgrades the interview screen into a multimodal AI interview room while preserving the v1 question bank, session history, streaming responses, 45-minute timer, and scorecard flow.

What was added:

- Zoom-style interview room with a top bar, large Alex interviewer panel, smaller candidate webcam panel, recent transcript, push-to-talk control, and text fallback input.
- Canvas-based Alex avatar with `idle`, `listening`, `thinking`, and `speaking` states.
- Push-to-talk voice input using the browser Web Speech API.
- Browser-native text-to-speech using `window.speechSynthesis`, with mute and skip controls.
- Webcam mirror and client-side facial expression detection using `face-api.js`.
- Optional message metadata for `emotion_label`, `input_mode`, and `transcript_confidence`.

Canvas was chosen over D-ID, HeyGen, Tavus, Ready Player Me, and other hosted avatar services because it keeps the prototype local, free, low-latency, and privacy-friendly. The avatar is deliberately abstract and geometric so it feels like a serious interview interface rather than a cartoon or paid talking-head integration.

Push-to-talk works in two ways: hold the on-screen button, or hold Space when focus is not inside a text field. Browsers with `SpeechRecognition` or `webkitSpeechRecognition` show interim speech while listening, then submit only the clean final transcript as the candidate answer. Unsupported browsers keep the text input fully available.

Emotion detection runs only inside the interview room and only when camera is enabled. The app requests webcam permission, mirrors the local video, loads `face-api.js` models from `frontend/public/models`, and samples facial expressions about every 300ms. Raw expressions are mapped into `neutral`, `confident`, `nervous`, `confused`, and `focused`, then stabilized with a short rolling window.

Emotion is passed to the backend only when the candidate submits an answer. The backend injects it as hidden prompt context for Alex, not as visible transcript text. For example, `nervous` asks Alex to reduce ambiguity slightly, `confused` asks Alex to reframe without giving away the answer, and `confident` lets Alex increase difficulty.

Current limitations:

- Web Speech API support varies by browser; Chrome-based browsers currently provide the best speech recognition support.
- `speechSynthesis` voice quality depends on the operating system and browser.
- Facial expression detection is approximate and should be treated as adaptive UI context, not a reliable assessment signal.
- Camera permission denial, missing models, or detection failure disables emotion detection without blocking text interviews.

Future TTS upgrade path:

- `useTTS` is isolated behind a small hook, so ElevenLabs can replace browser `speechSynthesis` later without changing the interview room flow.
- A future server endpoint can request ElevenLabs audio, stream or return the audio URL, and drive the same Alex `speaking` avatar state during playback.

## Technical Architecture

- React interview room controls voice, camera, avatar, transcript, and timer state.
- FastAPI keeps AI API access server-side and streams Alex responses over SSE.
- SQLite stores sessions, messages, scorecards, and lightweight candidate input metadata.
- Browser Web Speech API handles push-to-talk speech input.
- Browser SpeechSynthesis handles temporary Alex TTS output.
- `face-api.js` runs client-side expression detection from the webcam feed.
- Emotion metadata is passed into the AI prompt context to adapt Alex's follow-up strategy.

## Interview Room UX Notes

- The interview screen uses a fixed `100dvh` layout so it behaves like an app viewport, not a scrolling webpage.
- Only the transcript panel scrolls as messages stream or grow.
- Spacebar push-to-talk prevents default page scrolling when focus is outside text fields.
- Voice input uses the browser Web Speech API; Chrome and Edge are recommended.
- Text fallback always works even when voice, microphone, camera, emotion detection, or TTS is unavailable.

### Why SSE over WebSockets for streaming

Server-Sent Events (SSE) were chosen over WebSockets for the AI response streaming because the communication pattern is fundamentally unidirectional. The client sends a message via a standard POST request, and the server responds with a stream of tokens from the AI model. SSE leverages standard HTTP, works transparently through Vite's dev proxy, and requires no additional connection management libraries. WebSockets would add unnecessary complexity for bidirectional communication that isn't actually needed — the candidate's messages are always discrete request-response cycles, not a persistent bidirectional channel. SSE also plays naturally with FastAPI's `StreamingResponse`, which can consume an async generator and emit `text/event-stream` content without any framework extensions.

### Why SQLite over PostgreSQL

For a local-first demo application, SQLite eliminates all operational overhead. There's no database server to install, no connection pooling to configure, no migrations to run. SQLAlchemy's ORM abstracts the storage layer completely, so migrating to PostgreSQL (or any other dialect) later is a one-line change to the connection string. The concurrency model of SQLite is more than sufficient for a single-user interview simulation — peak traffic is one candidate sending a message and receiving a streamed response. The simplicity gain (zero-ops, zero-config) far outweighs any theoretical scalability benefit from a client-server database in this context.

### How the AI interviewer prompt was engineered

The system prompt for Alex is designed to avoid two common pitfalls in AI interview simulators: excessive helpfulness and generic feedback. By explicitly instructing DeepSeek to be "terse, professional, evaluative" and to "ask ONE focused question at a time", the prompt prevents the model from dumping a checklist of topics or hinting at the right answer. Specific behavioral rules (pressing vague answers, escalating on strong answers, staying silent when the candidate should be talking) create natural interview pressure. The 2-4 sentence response limit forces Alex to react conversationally rather than lecture, simulating the pace of a real system design interview where the interviewer reacts to each statement rather than delivering prepared content.

---

> Demo screenshots coming soon
