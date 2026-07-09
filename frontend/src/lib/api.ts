export interface Question {
  id: string;
  title: string;
  title_zh?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  description: string;
  description_zh?: string;
}

export type Language = 'en' | 'zh';

export interface JDProfile {
  id: number;
  company_name: string | null;
  role_title: string | null;
  seniority: string;
  domain: string;
  tech_stack: string[];
  responsibilities: string[];
  required_skills: string[];
  interview_focus: string[];
  language: Language;
}

export interface BlueprintQuestion {
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  why_relevant: string;
  expected_topics: string[];
}

export interface InterviewBlueprint {
  id: number;
  profile_id: number;
  summary: string;
  coding_focus: string[];
  cs_fundamentals_focus: string[];
  system_design_focus: string[];
  domain_deep_dive_focus: string[];
  behavioral_focus: string[];
  custom_system_design_questions: BlueprintQuestion[];
  scoring_focus: string[];
}

export interface SessionData {
  id: number;
  question_id: string;
  question_title: string;
  difficulty: string;
  interview_language: Language;
  session_type: 'built_in' | 'jd_tailored';
  profile_id: number | null;
  blueprint_id: number | null;
  custom_question_title: string | null;
  custom_question_context: BlueprintQuestion | null;
  profile: JDProfile | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  status: string;
  score_requirements: number | null;
  score_components: number | null;
  score_scalability: number | null;
  score_data_modeling: number | null;
  score_communication: number | null;
  score_total: number | null;
  missed_points: string[] | null;
  summary: string | null;
  role_fit_summary: string | null;
}

export interface MessageData {
  id: number;
  session_id: number;
  role: 'interviewer' | 'candidate';
  content: string;
  created_at: string;
  input_mode?: 'text' | 'voice' | null;
  transcript_confidence?: number | null;
}

export interface CreateSessionResponse {
  session: SessionData;
  opening_message: MessageData;
}

export interface SessionDetailResponse {
  session: SessionData;
  messages: MessageData[];
}

const BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export function getQuestions(): Promise<Question[]> {
  return fetchJson('/questions');
}

export function createSession(questionId: string, interviewLanguage: Language): Promise<CreateSessionResponse> {
  return fetchJson('/sessions', {
    method: 'POST',
    body: JSON.stringify({ question_id: questionId, interview_language: interviewLanguage }),
  });
}

export function createCustomSession(params: {
  profile_id: number;
  blueprint_id: number;
  custom_question_title: string;
  custom_question_context: BlueprintQuestion;
  difficulty: string;
  interview_language: Language;
}): Promise<CreateSessionResponse> {
  return fetchJson('/sessions', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function analyzeJD(params: {
  company_name?: string | null;
  role_title?: string | null;
  job_description: string;
  interview_language: Language;
}): Promise<{ profile: JDProfile; blueprint: InterviewBlueprint }> {
  return fetchJson('/jd/analyze', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function listSessions(): Promise<SessionData[]> {
  return fetchJson('/sessions');
}

export function getSession(sessionId: number): Promise<SessionDetailResponse> {
  return fetchJson(`/sessions/${sessionId}`);
}

export async function sendMessageStream(
  sessionId: number,
  content: string,
  metadata: {
    emotion_label?: string;
    input_mode?: 'text' | 'voice';
    transcript_confidence?: number;
  },
  onDelta: (text: string) => void,
  onDone: () => void,
  onError: (err: Error) => void
): Promise<void> {
  const res = await fetch(`${BASE}/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, ...metadata }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    onError(new Error('No response body'));
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');

      // Keep the last potentially incomplete chunk in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.done) {
            onDone();
            return;
          }
          if (data.delta) {
            onDelta(data.delta);
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

export function endSession(sessionId: number): Promise<SessionData> {
  return fetchJson(`/sessions/${sessionId}/end`, { method: 'POST' });
}
