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

export interface CandidateProfile {
  id: number | null;
  name: string | null;
  target_roles: string[];
  target_locations: string[];
  education: Record<string, string | number | null>;
  work_authorization_notes: string;
  skills: Record<string, string[]>;
  projects: Array<Record<string, unknown>>;
  preferences: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
}

export type CareerJobStatus = 'saved' | 'ready_to_apply' | 'applied' | 'oa' | 'interview' | 'rejected' | 'offer' | 'archived';
export type CareerJobPriority = 'high' | 'medium' | 'low' | 'unknown';

export interface ParsedCareerJob {
  company_name: string | null;
  role_title: string | null;
  location: string | null;
  employment_type: string;
  term: string;
  domain: string;
  tech_stack: Record<string, string[]>;
  responsibilities: string[];
  required_skills: string[];
  nice_to_have: string[];
  application_requirements: string[];
  deadline: string | null;
  work_authorization_signals: string[];
  ats_or_platform: string;
  summary: string;
  risk_flags: string[];
}

export interface FitBreakdown {
  overall_score: number;
  priority: CareerJobPriority;
  summary: string;
  breakdown: Record<string, number>;
  matched_strengths: string[];
  gaps: string[];
  recommended_resume_keywords: string[];
  recommended_projects_to_highlight: string[];
  next_action: string;
}

export interface CareerJob {
  id: number;
  company_name: string | null;
  role_title: string | null;
  location: string | null;
  job_url: string | null;
  application_url: string | null;
  source: string | null;
  raw_job_description: string | null;
  parsed_job: ParsedCareerJob | null;
  fit_score: number | null;
  fit_summary: string | null;
  fit_breakdown: FitBreakdown | null;
  status: CareerJobStatus;
  priority: CareerJobPriority;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}


export interface SearchPlanRequest {
  target_role: string;
  locations: string[];
  term?: string | null;
  domain?: string | null;
  keywords: string[];
  sources: string[];
  remote_preference: 'remote' | 'hybrid' | 'onsite' | 'any';
  experience_level: 'intern' | 'co-op' | 'new_grad' | 'any';
  output_language: Language;
}

export interface SearchQuery {
  source: string;
  query: string;
  url: string;
  why: string;
}

export interface SearchPlanResponse {
  search_summary: string;
  recommended_queries: SearchQuery[];
  source_strategy: Array<{ source: string; instructions: string }>;
  manual_steps: string[];
}

export interface JobLead {
  company_name: string | null;
  role_title: string | null;
  location: string | null;
  source: string | null;
  job_url: string | null;
  application_url: string | null;
  snippet: string | null;
  confidence: number;
  needs_jd: boolean;
  reason: string | null;
  duplicate_key?: string | null;
  duplicate_warning?: string | null;
}

export interface ExtractSearchResponse {
  job_leads: JobLead[];
  ignored_items: Array<{ text?: string; reason?: string }>;
}

export interface FetchPublicResponse {
  pages: Array<{ url: string; text: string | null; error: string | null }>;
  job_leads: JobLead[];
}

export interface SaveLeadsResponse {
  saved_jobs: CareerJob[];
  duplicates: JobLead[];
  skipped: Array<{ lead?: JobLead; reason?: string }>;
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

export function getCandidateProfile(): Promise<CandidateProfile> {
  return fetchJson('/career/profile');
}

export function saveCandidateProfile(profile: Omit<CandidateProfile, 'id' | 'created_at' | 'updated_at'>): Promise<CandidateProfile> {
  return fetchJson('/career/profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  });
}

export function listCareerJobs(): Promise<CareerJob[]> {
  return fetchJson('/career/jobs');
}

export function createCareerJob(job: Partial<CareerJob>): Promise<CareerJob> {
  return fetchJson('/career/jobs', {
    method: 'POST',
    body: JSON.stringify(job),
  });
}

export function getCareerJob(jobId: number): Promise<CareerJob> {
  return fetchJson(`/career/jobs/${jobId}`);
}

export function updateCareerJob(jobId: number, job: Partial<CareerJob>): Promise<CareerJob> {
  return fetchJson(`/career/jobs/${jobId}`, {
    method: 'PUT',
    body: JSON.stringify(job),
  });
}

export function deleteCareerJob(jobId: number): Promise<{ ok: boolean }> {
  return fetchJson(`/career/jobs/${jobId}`, { method: 'DELETE' });
}

export function parseCareerJob(jobId: number, outputLanguage: Language): Promise<CareerJob> {
  return fetchJson(`/career/jobs/${jobId}/parse`, {
    method: 'POST',
    body: JSON.stringify({ output_language: outputLanguage }),
  });
}

export function scoreCareerJob(jobId: number, outputLanguage: Language): Promise<CareerJob> {
  return fetchJson(`/career/jobs/${jobId}/score`, {
    method: 'POST',
    body: JSON.stringify({ output_language: outputLanguage }),
  });
}

export function prepareCareerInterview(jobId: number, outputLanguage: Language): Promise<{ profile: JDProfile; blueprint: InterviewBlueprint }> {
  return fetchJson(`/career/jobs/${jobId}/prepare-interview`, {
    method: 'POST',
    body: JSON.stringify({ output_language: outputLanguage }),
  });
}

export function generateSearchPlan(params: SearchPlanRequest): Promise<SearchPlanResponse> {
  return fetchJson('/career/search/plan', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function extractSearchLeads(params: {
  pasted_text: string;
  source_hint?: string;
  target_role?: string;
  locations?: string[];
  output_language: Language;
}): Promise<ExtractSearchResponse> {
  return fetchJson('/career/search/extract', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function fetchPublicSearchPages(params: {
  urls: string[];
  source_hint?: string;
  output_language: Language;
}): Promise<FetchPublicResponse> {
  return fetchJson('/career/search/fetch-public', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function saveSearchLeads(params: {
  leads: JobLead[];
  parse_and_score?: boolean;
  output_language: Language;
}): Promise<SaveLeadsResponse> {
  return fetchJson('/career/search/save-leads', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// ===== v4.3 Paste Job Page =====

export interface PasteTechStack {
  languages: string[];
  frontend: string[];
  backend: string[];
  databases: string[];
  cloud_devops: string[];
  networking: string[];
  ai_tools: string[];
  testing: string[];
  other: string[];
}

export interface PasteExtractedJob {
  company_name: string | null;
  role_title: string | null;
  location: string | null;
  experience_level: string;
  employment_type: string;
  term: string | null;
  domain: string;
  source: string | null;
  job_url: string | null;
  application_url: string | null;
  salary_range: string | null;
  deadline: string | null;
  application_checklist: string[];
  tech_stack: PasteTechStack;
  responsibilities: string[];
  requirements: string[];
  nice_to_have: string[];
  risk_flags: string[];
  summary: string;
}

export interface PasteFit {
  overall_score: number;
  decision: 'apply' | 'maybe' | 'skip' | 'needs_more_info';
  priority: 'high' | 'medium' | 'low';
  summary: string;
  main_reason: string;
  breakdown: {
    role_match: number;
    tech_stack_match: number;
    location_match: number;
    experience_level_match: number;
    project_relevance: number;
    application_risk: number;
  };
  matched_strengths: string[];
  gaps: string[];
  risk_flags: string[];
  recommended_resume_keywords: string[];
  recommended_projects_to_highlight: string[];
  next_action: string;
}

export interface PasteAnalysisResult {
  is_job_posting: true;
  confidence: number;
  extracted_job: PasteExtractedJob;
  fit: PasteFit;
  cleaned_jd_text: string;
  ignored_noise: string[];
}

export interface PasteNotJobResult {
  is_job_posting: false;
  confidence: number;
  reason: string;
  possible_next_steps: string[];
}

export type PasteAnalyzeResponse = PasteAnalysisResult | PasteNotJobResult;

export interface PasteSaveResponse {
  job: CareerJob;
  prepared_interview: { profile: JDProfile; blueprint: InterviewBlueprint } | null;
  next_route: string;
}

export function analyzePastedJobPage(params: {
  pasted_page_text: string;
  source_hint?: string;
  job_url?: string;
  application_url?: string;
  notes?: string;
  output_language: Language;
}): Promise<PasteAnalyzeResponse> {
  return fetchJson('/career/paste/analyze', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function savePastedJob(params: {
  analysis_result: PasteAnalysisResult;
  save_mode: 'save_only' | 'save_parse_score' | 'save_prepare_interview';
  output_language: Language;
}): Promise<PasteSaveResponse> {
  return fetchJson('/career/paste/save', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export interface ResumeProfileAnalysis {
  name: string;
  education: Record<string, string>;
  target_roles: string[];
  target_locations: string[];
  skills: Record<string, string[]>;
  projects: Array<Record<string, unknown>>;
  experience: Array<Record<string, unknown>>;
  preferred_domains: string[];
  search_keywords: string[];
  suggested_job_titles: string[];
  strengths: string[];
  gaps: string[];
}

export interface ResumeAnalysisResponse {
  resume_profile: ResumeProfileAnalysis;
  recommended_search_queries: Array<{ label: string; query: string; why: string }>;
  profile_summary: string;
}

export async function analyzeResume(params: { resumeFile?: File | null; resumeText?: string; outputLanguage: Language }): Promise<ResumeAnalysisResponse> {
  const body = new FormData();
  if (params.resumeFile) body.append('resume_file', params.resumeFile);
  if (params.resumeText) body.append('resume_text', params.resumeText);
  body.append('output_language', params.outputLanguage);
  const res = await fetch(`${BASE}/career/profile/analyze-resume`, { method: 'POST', body });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}

export function applyResumeAnalysis(resumeProfile: ResumeProfileAnalysis, mergeMode: 'replace' | 'merge'): Promise<CandidateProfile> {
  return fetchJson('/career/profile/apply-resume-analysis', { method: 'POST', body: JSON.stringify({ resume_profile: resumeProfile, merge_mode: mergeMode }) });
}
