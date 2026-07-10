import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LanguageControls from '../components/LanguageControls';
import MainNav from '../components/MainNav';
import BackLink from '../components/ui/BackLink';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import {
  analyzePastedJobPage,
  savePastedJob,
  type PasteAnalysisResult,
  type PasteAnalyzeResponse,
} from '../lib/api';
import { useI18n } from '../i18n/useI18n';

const SOURCE_OPTIONS = [
  'unknown',
  'LinkedIn',
  'Indeed',
  'Glassdoor',
  'Company Careers',
  'Greenhouse',
  'Lever',
  'Workday',
  'Job Bank',
  'Wellfound',
  'Email Alert',
  'Manual',
];

const DECISION_COLORS: Record<string, string> = {
  apply: '#4ade80',
  maybe: '#facc15',
  skip: '#f87171',
  needs_more_info: '#888888',
};

function Tags({ items }: { items?: string[] }) {
  if (!items?.length) return <span className="muted">-</span>;
  return (
    <div className="tag-list">
      {items.map((item) => (
        <span className="tag" key={item}>{item}</span>
      ))}
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <section className="blueprint-section">
      <h3>{title}</h3>
      <ul>{items.map((item, i) => <li key={i}>{item}</li>)}</ul>
    </section>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="scorecard-dim">
      <div className="scorecard-dim-header">
        <span className="scorecard-dim-label">{label.replace(/_/g, ' ')}</span>
        <span className="scorecard-dim-score">{value}/100</span>
      </div>
      <div className="scorecard-bar-bg">
        <div
          className="scorecard-bar-fill"
          style={{ width: `${value}%`, backgroundColor: 'var(--easy)' }}
        />
      </div>
    </div>
  );
}

export default function CareerPasteJob() {
  const { t, interviewLanguage } = useI18n();
  const navigate = useNavigate();

  // Input state
  const [pastedText, setPastedText] = useState('');
  const [sourceHint, setSourceHint] = useState('unknown');
  const [jobUrl, setJobUrl] = useState('');
  const [applicationUrl, setApplicationUrl] = useState('');
  const [notes, setNotes] = useState('');

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<PasteAnalyzeResponse | null>(null);
  const [analysisError, setAnalysisError] = useState('');

  // Save state
  const [saving, setSaving] = useState('');
  const [saveError, setSaveError] = useState('');

  const isShort = pastedText.trim().length > 0 && pastedText.trim().length < 300;

  const handleAnalyze = async () => {
    if (!pastedText.trim()) return;
    setAnalyzing(true);
    setAnalysisError('');
    setAnalysisResult(null);
    setSaveError('');
    try {
      const result = await analyzePastedJobPage({
        pasted_page_text: pastedText,
        source_hint: sourceHint,
        job_url: jobUrl || undefined,
        application_url: applicationUrl || undefined,
        notes: notes || undefined,
        language: interviewLanguage,
      });
      setAnalysisResult(result);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async (mode: 'save_only' | 'save_parse_score' | 'save_prepare_interview') => {
    if (!analysisResult || !analysisResult.is_job_posting) return;
    setSaving(mode);
    setSaveError('');
    try {
      const res = await savePastedJob({
        analysis_result: analysisResult as PasteAnalysisResult,
        save_mode: mode,
        language: interviewLanguage,
      });
      if (mode === 'save_prepare_interview' && res.prepared_interview) {
        navigate('/custom', { state: res.prepared_interview });
      } else {
        navigate(res.next_route || `/career/jobs/${res.job.id}`);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving('');
    }
  };

  const handleClear = () => {
    setPastedText('');
    setSourceHint('unknown');
    setJobUrl('');
    setApplicationUrl('');
    setNotes('');
    setAnalysisResult(null);
    setAnalysisError('');
    setSaveError('');
  };

  const jobResult = analysisResult?.is_job_posting ? (analysisResult as PasteAnalysisResult) : null;
  const notJobResult = analysisResult && !analysisResult.is_job_posting ? analysisResult : null;

  return (
    <div className="career-page">
      <header className="home-header">
        <div className="logo-area">
          <h1 className="wordmark">{t('pasteJobPage')}</h1>
          <p className="tagline">{t('pasteAnyJobPostingDesc')}</p>
        </div>
        <MainNav />
      </header>
      <LanguageControls />

      <div className="page-back-row">
        <BackLink to="/career" label={t('backToCareerMode')} />
      </div>

      {/* Input Section */}
      <section className="career-panel">
        <h2>{t('pasteAnyJobPosting')}</h2>
        <p className="muted" style={{ marginBottom: '16px' }}>{t('pasteAnyJobPostingDesc')}</p>

        <div className="paste-job-form">
          <label className="field-label" htmlFor="paste-job-text">
            {t('pasteJobPage')} *
          </label>
          <textarea
            id="paste-job-text"
            className="paste-job-textarea"
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder={t('pasteJobTextPlaceholder')}
            rows={12}
            aria-label={t('pasteJobPage')}
          />
          {isShort && (
            <p className="paste-warning" role="alert" aria-live="polite">
              ⚠ {t('shortTextWarning')}
            </p>
          )}

          <div className="paste-optional-row">
            <div className="paste-field">
              <label className="field-label" htmlFor="paste-source-hint">{t('sourceHint')}</label>
              <select
                id="paste-source-hint"
                value={sourceHint}
                onChange={(e) => setSourceHint(e.target.value)}
                aria-label={t('sourceHint')}
              >
                {SOURCE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="paste-field">
              <label className="field-label" htmlFor="paste-job-url">{t('jobUrl')}</label>
              <input
                id="paste-job-url"
                type="url"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="https://..."
                aria-label={t('jobUrl')}
              />
            </div>
            <div className="paste-field">
              <label className="field-label" htmlFor="paste-app-url">{t('applicationUrl')}</label>
              <input
                id="paste-app-url"
                type="url"
                value={applicationUrl}
                onChange={(e) => setApplicationUrl(e.target.value)}
                placeholder="https://..."
                aria-label={t('applicationUrl')}
              />
            </div>
          </div>

          <div className="paste-field" style={{ marginTop: '8px' }}>
            <label className="field-label" htmlFor="paste-notes">{t('notes')}</label>
            <input
              id="paste-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('notes')}
              aria-label={t('notes')}
            />
          </div>

          <div className="form-actions" style={{ marginTop: '16px' }}>
            <button
              id="paste-analyze-btn"
              className="btn-filled"
              onClick={handleAnalyze}
              disabled={!pastedText.trim() || analyzing}
              aria-disabled={!pastedText.trim() || analyzing}
            >
              {analyzing ? <><LoadingSpinner inline /> {t('analyzing')}</> : t('analyzeJob')}
            </button>
            <button className="btn-text" onClick={handleClear} disabled={analyzing}>
              {t('clearForm')}
            </button>
          </div>
        </div>

        {analysisError && (
          <p className="form-error" role="alert">{t('analysisError')}: {analysisError}</p>
        )}
      </section>

      {/* Not a job posting result */}
      {notJobResult && (
        <section className="career-panel paste-not-job" role="alert">
          <h2>🚫 {t('notAJobPosting')}</h2>
          <p className="muted">{notJobResult.reason}</p>
          <p style={{ marginTop: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
            {t('confidence')}: {notJobResult.confidence}/100
          </p>
          {notJobResult.possible_next_steps?.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <strong>{t('possibleNextSteps')}:</strong>
              <ul style={{ marginTop: '6px', paddingLeft: '18px' }}>
                {notJobResult.possible_next_steps.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Full analysis result */}
      {jobResult && (
        <>
          {/* Decision Card */}
          <section
            className="career-panel paste-decision-card"
            style={{ borderLeft: `4px solid ${DECISION_COLORS[jobResult.fit.decision] || '#888'}` }}
          >
            <div className="paste-decision-header">
              <div>
                <div className="paste-decision-label">{t('fitDecision')}</div>
                <div
                  className="paste-decision-value"
                  style={{ color: DECISION_COLORS[jobResult.fit.decision] }}
                  id="paste-decision"
                >
                  {jobResult.fit.decision === 'apply' && t('decisionApply')}
                  {jobResult.fit.decision === 'maybe' && t('decisionMaybe')}
                  {jobResult.fit.decision === 'skip' && t('decisionSkip')}
                  {jobResult.fit.decision === 'needs_more_info' && t('decisionNeedsMoreInfo')}
                </div>
              </div>
              <div>
                <div className="paste-decision-label">{t('matchScore')}</div>
                <div className="paste-decision-value" id="paste-match-score">
                  {jobResult.fit.overall_score}/100
                </div>
              </div>
              <div>
                <div className="paste-decision-label">{t('priority')}</div>
                <div className="paste-decision-value">
                  {jobResult.fit.priority === 'high' && t('priorityHigh')}
                  {jobResult.fit.priority === 'medium' && t('priorityMedium')}
                  {jobResult.fit.priority === 'low' && t('priorityLow')}
                </div>
              </div>
              <div className="paste-decision-label" style={{ fontSize: '12px' }}>
                {t('confidence')}: {jobResult.confidence}/100
              </div>
            </div>

            {jobResult.fit.main_reason && (
              <div style={{ marginTop: '12px' }}>
                <strong>{t('mainReason')}:</strong>
                <p id="paste-main-reason" style={{ marginTop: '4px' }}>{jobResult.fit.main_reason}</p>
              </div>
            )}

            {jobResult.fit.summary && (
              <p className="blueprint-summary" style={{ marginTop: '8px' }}>{jobResult.fit.summary}</p>
            )}

            {/* Save Actions */}
            <div className="paste-save-actions">
              <button
                id="paste-save-to-tracker"
                className="btn-filled"
                onClick={() => handleSave('save_only')}
                disabled={!!saving}
                aria-disabled={!!saving}
              >
                {saving === 'save_only' ? <><LoadingSpinner inline /> {t('saving')}</> : t('saveToTracker')}
              </button>
              <button
                id="paste-save-parse-score"
                className="btn-text"
                onClick={() => handleSave('save_parse_score')}
                disabled={!!saving}
                aria-disabled={!!saving}
              >
                {saving === 'save_parse_score' ? <><LoadingSpinner inline /> {t('saving')}</> : t('savePlusParseScore')}
              </button>
              <button
                id="paste-save-prepare-interview"
                className="btn-text"
                onClick={() => handleSave('save_prepare_interview')}
                disabled={!!saving}
                aria-disabled={!!saving}
              >
                {saving === 'save_prepare_interview' ? <><LoadingSpinner inline /> {t('saving')}</> : t('savePlusPrepareInterview')}
              </button>
            </div>
            {saveError && <p className="form-error" role="alert">{saveError}</p>}
          </section>

          {/* Extracted Fields */}
          <section className="career-panel">
            <h2>{t('extractedFields')}</h2>
            <div className="profile-grid">
              <span>{t('company')}</span><strong id="paste-company">{jobResult.extracted_job.company_name || '-'}</strong>
              <span>{t('role')}</span><strong id="paste-role">{jobResult.extracted_job.role_title || '-'}</strong>
              <span>{t('location')}</span><strong>{jobResult.extracted_job.location || '-'}</strong>
              <span>{t('experienceLevelLabel')}</span><strong>{jobResult.extracted_job.experience_level || '-'}</strong>
              <span>{t('employmentTypeLabel')}</span><strong>{jobResult.extracted_job.employment_type || '-'}</strong>
              <span>{t('domainLabel')}</span><strong>{jobResult.extracted_job.domain || '-'}</strong>
              <span>{t('sourceLabel')}</span><strong>{jobResult.extracted_job.source || '-'}</strong>
              {jobResult.extracted_job.salary_range && (
                <><span>{t('salaryLabel')}</span><strong>{jobResult.extracted_job.salary_range}</strong></>
              )}
              {jobResult.extracted_job.deadline && (
                <><span>{t('deadlineLabel')}</span><strong>{jobResult.extracted_job.deadline}</strong></>
              )}
              {jobResult.extracted_job.job_url && (
                <><span>{t('jobUrl')}</span>
                  <a className="btn-text small" href={jobResult.extracted_job.job_url} target="_blank" rel="noreferrer">
                    {jobResult.extracted_job.job_url.slice(0, 60)}… ↗
                  </a>
                </>
              )}
              {jobResult.extracted_job.application_url && (
                <><span>{t('applicationUrl')}</span>
                  <a className="btn-text small" href={jobResult.extracted_job.application_url} target="_blank" rel="noreferrer">
                    {t('openApplication')} ↗
                  </a>
                </>
              )}
            </div>
            <p className="blueprint-summary" style={{ marginTop: '12px' }}>{jobResult.extracted_job.summary}</p>
          </section>

          {/* Tech Stack */}
          {(() => {
            const ts = jobResult.extracted_job.tech_stack;
            const allEntries = Object.entries(ts).filter(([, v]) => v.length > 0);
            if (!allEntries.length) return null;
            return (
              <section className="career-panel">
                <h2>{t('techStackSection')}</h2>
                <div className="blueprint-grid">
                  {allEntries.map(([key, items]) => (
                    <div key={key} className="blueprint-section">
                      <h3>{key.replace(/_/g, ' ')}</h3>
                      <Tags items={items} />
                    </div>
                  ))}
                </div>
              </section>
            );
          })()}

          {/* Content lists */}
          <section className="career-panel">
            <div className="blueprint-grid">
              <ListBlock title={t('responsibilitiesSection')} items={jobResult.extracted_job.responsibilities} />
              <ListBlock title={t('requirementsSection')} items={jobResult.extracted_job.requirements} />
              <ListBlock title={t('niceToHaveSection')} items={jobResult.extracted_job.nice_to_have} />
              <ListBlock title={t('applicationChecklist')} items={jobResult.extracted_job.application_checklist} />
              <ListBlock title={t('riskFlagsSection')} items={jobResult.extracted_job.risk_flags} />
            </div>
          </section>

          {/* Fit Breakdown */}
          <section className="career-panel">
            <h2>{t('fitBreakdownSection')}</h2>
            <div className="scorecard-dims">
              {Object.entries(jobResult.fit.breakdown).map(([key, value]) => (
                <ScoreBar key={key} label={key} value={value} />
              ))}
            </div>
            <div className="blueprint-grid" style={{ marginTop: '16px' }}>
              <ListBlock title={t('strengthsSection')} items={jobResult.fit.matched_strengths} />
              <ListBlock title={t('gapsSection')} items={jobResult.fit.gaps} />
              <ListBlock title={t('riskFlagsSection')} items={jobResult.fit.risk_flags} />
              <ListBlock title={t('resumeKeywordsSection')} items={jobResult.fit.recommended_resume_keywords} />
              <ListBlock title={t('projectsToHighlightSection')} items={jobResult.fit.recommended_projects_to_highlight} />
            </div>
          </section>

          {/* Cleaned JD */}
          {jobResult.cleaned_jd_text && (
            <section className="career-panel">
              <h2>{t('cleanedJd')}</h2>
              <pre className="jd-pre">{jobResult.cleaned_jd_text}</pre>
              {jobResult.ignored_noise?.length > 0 && (
                <p className="muted" style={{ marginTop: '8px' }}>
                  {t('ignoredNoise')}: {jobResult.ignored_noise.length} items
                </p>
              )}
            </section>
          )}

          {/* Repeat save actions at bottom */}
          <section className="career-panel">
            <div className="paste-save-actions">
              <button
                className="btn-filled"
                onClick={() => handleSave('save_only')}
                disabled={!!saving}
                aria-disabled={!!saving}
              >
                {saving === 'save_only' ? t('saving') : t('saveToTracker')}
              </button>
              <button
                className="btn-text"
                onClick={() => handleSave('save_parse_score')}
                disabled={!!saving}
                aria-disabled={!!saving}
              >
                {saving === 'save_parse_score' ? t('saving') : t('savePlusParseScore')}
              </button>
              <button
                className="btn-text"
                onClick={() => handleSave('save_prepare_interview')}
                disabled={!!saving}
                aria-disabled={!!saving}
              >
                {saving === 'save_prepare_interview' ? t('saving') : t('savePlusPrepareInterview')}
              </button>
              <button className="btn-text" onClick={handleClear}>{t('discard')}</button>
            </div>
            {saveError && <p className="form-error" role="alert">{saveError}</p>}
          </section>
        </>
      )}
    </div>
  );
}
