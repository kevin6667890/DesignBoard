# DesignBoard

DesignBoard is a multimodal AI interview simulator for CS students preparing for technical internships.

It turns system design practice into a live interview room: an AI interviewer asks adaptive follow-up questions, listens through push-to-talk voice input, speaks responses with browser TTS, displays an animated Canvas avatar, and adjusts interview pressure using webcam-based emotion detection.

Python · FastAPI · React · TypeScript · SQLite · DeepSeek API · face-api.js

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-local-003B57?logo=sqlite&logoColor=white)

## Highlights

- **Multimodal Interview Room** - Zoom-style interview layout with Alex, webcam mirror, transcript, timer, and text fallback.
- **Adaptive AI Interviewer** - DeepSeek-powered interviewer probes requirements, tradeoffs, scalability, data modeling, and failure modes.
- **Voice Interaction** - Push-to-talk via Web Speech API, plus browser-native TTS for Alex responses.
- **Emotion-Aware Follow-ups** - face-api.js detects candidate state and passes hidden context into the AI prompt.
- **Real System Design Practice** - 16 curated prompts across Easy, Medium, and Hard difficulty.
- **Bilingual App Support** - English and Chinese UI controls are separate from the interview language used by Alex and scorecards.
- **JD-Tailored Interview Planner** - Paste a job description to generate a role profile, interview blueprint, and start a custom system design interview.
- **Career Mode / Internship Radar** - Track Canadian internship opportunities, parse JDs, score fit, and send saved jobs into interview prep.
- **Automated Scorecards** - Evaluates Requirements, Components, Scalability, Data Modeling, and Communication.
- **Session History** - SQLite-backed interview records with scorecard review.

## Demo

Demo screenshots coming soon.

## Architecture

```text
Browser (React/Vite)
       |
       | /api/* proxy + SSE stream
       v
FastAPI Backend -----> DeepSeek API
       |
       v
SQLite (sessions + messages + scorecards)
```

Client-side browser APIs handle voice input, temporary speech output, webcam preview, and approximate expression detection. FastAPI keeps DeepSeek API access server-side and persists interview state in SQLite.

## Features

1. **Multimodal Interview Room** - A fixed Zoom-style interview room with Alex, webcam mirror, transcript, timer, push-to-talk, and fallback text input.
2. **AI Interviewer Alex** - DeepSeek-powered interviewer that asks focused follow-ups and probes requirements, capacity estimation, components, data modeling, scalability, and failure modes.
3. **Voice Input and TTS** - Push-to-talk speech input through the Web Speech API, plus browser-native `speechSynthesis` for Alex responses.
4. **Webcam Emotion Detection** - Optional client-side face-api.js expression detection maps raw expressions into simple adaptive context labels such as `neutral`, `focused`, `nervous`, `confused`, and `confident`.
5. **Live Streaming Responses** - Server-Sent Events deliver DeepSeek responses incrementally as Alex responds.
6. **45-Minute Timer** - Interview-style time limit with color transitions and auto-end behavior when time expires.
7. **Automated Scorecard** - DeepSeek generates a scored evaluation across Requirements, Components, Scalability, Data Modeling, and Communication.
8. **Session History** - Review past interviews with stored transcript and scorecard results.
9. **Curated System Design Questions** - 16 prompts inspired by common system design interview patterns across Easy, Medium, and Hard difficulty.
10. **Career Mode / Internship Radar** - Candidate profile, manual job intake, AI JD parsing, fit scoring, application tracking, and search query generation.
11. **Dark Theme** - Minimal, low-contrast interface with a serious interview-room feel.

## Project Status

DesignBoard currently supports local-first interview simulation with AI streaming, voice input, browser TTS, webcam emotion detection, persistent session history, automated scorecards, bilingual UI/interview language controls, JD-tailored system design interviews, and Career Mode internship tracking.

## Bilingual App Support

DesignBoard supports English and Chinese for actual app usage. UI language and interview language are separate settings:

- UI language controls navigation, labels, buttons, history, and planner screens.
- Interview language controls Alex's interview prompts, browser TTS voice preference, generated JD blueprint content, and scorecard language.
- Built-in question titles include Chinese display fields with English fallback, so existing question data and old sessions remain compatible.

The README and GitHub presentation remain English.

## JD-Tailored Interview Planner

JD mode is implemented as a local-first, JD-only flow:

- Paste a job description, with optional company name and role title.
- DeepSeek extracts company, role, seniority, domain, tech stack, responsibilities, required skills, and likely interview focus.
- DesignBoard generates an interview blueprint with coding, CS fundamentals, system design, domain deep-dive, behavioral, and scoring focus sections.
- Recommended custom system design questions can start an interview immediately.
- Custom sessions carry JD profile and blueprint context into Alex's hidden prompt, and scorecards can include Role Fit / JD Alignment.

Company web research is planned but not implemented. Coding/editor rounds are planned but not implemented.

## Career Mode / Internship Radar

Career Mode helps a CS student organize Canadian internship opportunities without scraping job boards or automating applications.

- **Candidate profile** - Store target roles, target locations, education, skills, projects, work authorization notes, and preferences locally in SQLite.
- **Job intake** - Manually save pasted job descriptions, job posting URLs, application URLs, source, status, priority, and notes.
- **AI JD parsing** - DeepSeek extracts company, role, location, term, domain, tech stack, responsibilities, requirements, platform hints, summaries, and risk flags from pasted JDs.
- **Fit scoring** - Compares parsed jobs against the candidate profile and returns a conservative score, priority, strengths, gaps, resume keywords, project highlights, and next action.
- **Application tracking** - Track saved, ready to apply, applied, OA, interview, rejected, offer, and archived statuses with quick updates.
- **Search query generator** - Generates copyable search queries and safe Google search links for internship channels such as Greenhouse, Lever, LinkedIn, Indeed, company career pages, Wellfound, Job Bank, and university portals.
- **Interview preparation handoff** - Sends a saved job with a pasted JD into the existing JD-tailored interview planner so the user can generate a blueprint and start a custom system design interview.

Career Mode does not scrape LinkedIn, Indeed, Glassdoor, or protected platforms. It does not auto-apply, bypass rate limits, handle captchas, or provide legal/immigration advice.

## Roadmap

- v4 Career Mode is implemented.
- Future: coding round, CS fundamentals round, company research, and resume tailoring.

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

# 4. Start both servers in separate terminals

# Terminal 1 - Backend (port 8000)
cd backend
uvicorn main:app --reload --port 8000

# Terminal 2 - Frontend (port 5173)
cd frontend
npm run dev

# 5. Open http://localhost:5173
```

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
- FastAPI keeps DeepSeek API access server-side and streams Alex responses over SSE.
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

## Technical Decisions

### Why SSE over WebSockets for streaming

Server-Sent Events (SSE) were chosen over WebSockets for the AI response streaming because the communication pattern is fundamentally unidirectional. The client sends a message via a standard POST request, and the server responds with a stream of tokens from the AI model. SSE leverages standard HTTP, works transparently through Vite's dev proxy, and requires no additional connection management libraries. WebSockets would add unnecessary complexity for bidirectional communication that is not actually needed because the candidate's messages are discrete request-response cycles, not a persistent bidirectional channel. SSE also plays naturally with FastAPI's `StreamingResponse`, which can consume an async generator and emit `text/event-stream` content without any framework extensions.

### Why SQLite over PostgreSQL

For a local-first demo application, SQLite eliminates operational overhead. There is no database server to install, no connection pooling to configure, and no migrations to run for the current schema. SQLAlchemy's ORM abstracts the storage layer, so migrating to PostgreSQL or another dialect later is mostly a configuration change. The concurrency model of SQLite is sufficient for a single-user interview simulation: peak traffic is one candidate sending a message and receiving a streamed response. The simplicity gain outweighs any theoretical scalability benefit from a client-server database in this context.

### How the AI interviewer prompt was engineered

The system prompt for Alex is designed to avoid two common pitfalls in AI interview simulators: excessive helpfulness and generic feedback. By instructing DeepSeek to be terse, professional, evaluative, and to ask one focused question at a time, the prompt prevents the model from dumping a checklist of topics or hinting at the right answer. Specific behavioral rules for pressing vague answers, probing weak answers, escalating strong answers, and asking what the candidate is considering during pauses create interview-style pressure. The 2-4 sentence response limit forces Alex to react conversationally rather than lecture.
