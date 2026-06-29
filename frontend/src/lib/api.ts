export interface Question {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  description: string;
}

export interface SessionData {
  id: number;
  question_id: string;
  question_title: string;
  difficulty: string;
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
}

export interface MessageData {
  id: number;
  session_id: number;
  role: 'interviewer' | 'candidate';
  content: string;
  created_at: string;
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

export function createSession(questionId: string): Promise<CreateSessionResponse> {
  return fetchJson('/sessions', {
    method: 'POST',
    body: JSON.stringify({ question_id: questionId }),
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
  onDelta: (text: string) => void,
  onDone: () => void,
  onError: (err: Error) => void
): Promise<void> {
  const res = await fetch(`${BASE}/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
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
