import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LanguageControls from '../components/LanguageControls';
import MainNav from '../components/MainNav';
import BackLink from '../components/ui/BackLink';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorState from '../components/ui/ErrorState';
import {
  getCareerJob,
  parseCareerJob,
  prepareCareerInterview,
  scoreCareerJob,
  updateCareerJob,
  deleteCareerJob,
  type CareerJob,
} from '../lib/api';
import { useI18n } from '../i18n/useI18n';

function Tags({ items }: { items?: string[] }) {
  return <div className="tag-list">{items?.length ? items.map((item) => <span className="tag" key={item}>{item}</span>) : <span className="muted">-</span>}</div>;
}

function ListBlock({ title, items }: { title: string; items?: string[] }) {
  return (
    <section className="blueprint-section">
      <h3>{title}</h3>
      {items?.length ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="muted">-</p>}
    </section>
  );
}

export default function CareerJobDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const { t, uiLanguage } = useI18n();
  const navigate = useNavigate();
  const [job, setJob] = useState<CareerJob | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [draftNotes, setDraftNotes] = useState('');

  const load = () => {
    if (!jobId) return;
    setLoadError(false);
    getCareerJob(Number(jobId))
      .then((j) => {
        setJob(j);
        setDraftNotes(j.notes || '');
      })
      .catch(() => setLoadError(true));
  };

  useEffect(load, [jobId]);

  const refreshWith = (promise: Promise<CareerJob>, label: string) => {
    setWorking(label);
    setError('');
    promise
      .then((j) => { setJob(j); setDraftNotes(j.notes || ''); })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setWorking(''));
  };

  const handlePrepare = async () => {
    if (!job) return;
    if (!job.raw_job_description?.trim()) {
      setError(t('addJdBeforeInterview'));
      return;
    }
    setWorking(t('preparingInterview'));
    setError('');
    try {
      // This creates Career-visible JD/blueprint content; live interview sessions retain interviewLanguage.
      const result = await prepareCareerInterview(job.id, uiLanguage);
      navigate('/custom', { state: result });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking('');
    }
  };

  const saveJd = () => {
    if (!job) return;
    refreshWith(updateCareerJob(job.id, job), t('saveJob'));
  };

  const saveNotes = () => {
    if (!job) return;
    refreshWith(updateCareerJob(job.id, { ...job, notes: draftNotes }), t('notes'));
    setEditingNotes(false);
  };

  const handleDelete = async () => {
    if (!job) return;
    try {
      await deleteCareerJob(job.id);
      navigate('/career/jobs');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setDeleteConfirming(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!job) return;
    refreshWith(updateCareerJob(job.id, { ...job, status: newStatus as CareerJob['status'] }), t('status'));
    setEditingStatus(false);
  };

  if (!job && loadError) {
    return (
      <div className="career-page">
        <header className="home-header">
          <div className="logo-area"><h1 className="wordmark">{t('careerMode')}</h1></div>
          <MainNav />
        </header>
        <ErrorState message={t('failedToLoadJobs')} onRetry={load} retryLabel={t('tryAgain')} />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="interview-loading">
        <LoadingSpinner message={t('loading')} />
      </div>
    );
  }

  const parsed = job.parsed_job;
  const fit = job.fit_breakdown;
  const allTech = parsed ? Object.values(parsed.tech_stack || {}).flat() : [];
  const hasJd = !!job.raw_job_description?.trim();

  return (
    <div className="career-page">
      <header className="home-header">
        <div className="logo-area">
          <h1 className="wordmark">{job.company_name || t('needsJd')}</h1>
          <p className="tagline">{job.role_title || t('jobDescription')}</p>
        </div>
        <MainNav />
      </header>
      <LanguageControls />

      <div className="page-back-row">
        <BackLink to="/career/jobs" label={t('backToJobTracker')} />
      </div>

      <section className="career-panel">
        <div className="panel-title-row">
          <div>
            <h2>{job.role_title || t('needsJd')}</h2>
            <p className="muted">{job.location || '-'} · {job.source || '-'}</p>
          </div>
          <div className="career-actions">
            <button
              className="btn-text"
              onClick={() => refreshWith(parseCareerJob(job.id, uiLanguage), t('parsingJd'))}
              disabled={!!working || !hasJd}
              aria-disabled={!!working || !hasJd}
              title={!hasJd ? t('addJdBeforeInterview') : undefined}
            >
              {working === t('parsingJd') ? t('parsingJd') : t('parseJd')}
            </button>
            <button
              className="btn-text"
              onClick={() => refreshWith(scoreCareerJob(job.id, uiLanguage), t('scoringJob'))}
              disabled={!!working || !hasJd}
              aria-disabled={!!working || !hasJd}
              title={!hasJd ? t('addJdBeforeInterview') : undefined}
            >
              {working === t('scoringJob') ? t('scoringJob') : t('generateFitScore')}
            </button>
            <button
              className="btn-filled"
              onClick={handlePrepare}
              disabled={!!working}
              aria-disabled={!!working}
              title={!hasJd ? t('addJdBeforeInterview') : undefined}
            >
              {working === t('preparingInterview') ? t('preparingInterview') : t('prepareInterview')}
            </button>
          </div>
        </div>
        {working && <p className="loading-text" aria-live="polite"><LoadingSpinner inline message={working} /></p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {!hasJd && (
          <div className="info-banner" role="note">{t('noJdWarning')}</div>
        )}

        <div className="profile-grid">
          <span>{t('status')}</span>
          <span>
            {editingStatus ? (
              <select
                value={job.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                autoFocus
                onBlur={() => setEditingStatus(false)}
                aria-label={t('status')}
              >
                {['saved', 'ready_to_apply', 'applied', 'oa', 'interview', 'rejected', 'offer', 'archived'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            ) : (
              <button className="btn-text small" onClick={() => setEditingStatus(true)}>
                <strong>{job.status}</strong> ✎
              </button>
            )}
          </span>
          <span>{t('priority')}</span><strong>{job.priority}</strong>
          <span>{t('fitScore')}</span><strong>{job.fit_score !== null ? `${job.fit_score}/100` : '-'}</strong>
          <span>{t('nextAction')}</span><strong>{fit?.next_action || '-'}</strong>
        </div>

        <div className="job-url-row">
          {job.job_url && (
            <a className="btn-text small" href={job.job_url} target="_blank" rel="noreferrer">
              {t('jobUrl')} ↗
            </a>
          )}
          {job.application_url && (
            <a className="btn-text small" href={job.application_url} target="_blank" rel="noreferrer">
              {t('openApplication')} ↗
            </a>
          )}
        </div>
      </section>

      <section className="career-panel">
        <div className="panel-title-row">
          <h2>{t('notes')}</h2>
          {!editingNotes && (
            <button className="btn-text small" onClick={() => setEditingNotes(true)} aria-label={t('editNotes')}>
              {t('editNotes')}
            </button>
          )}
        </div>
        {editingNotes ? (
          <>
            <textarea
              className="profile-form"
              value={draftNotes}
              onChange={(e) => setDraftNotes(e.target.value)}
              aria-label={t('notes')}
              autoFocus
            />
            <div className="form-actions">
              <button className="btn-filled" onClick={saveNotes}>{t('saveJob')}</button>
              <button className="btn-text" onClick={() => { setEditingNotes(false); setDraftNotes(job.notes || ''); }}>{t('cancel')}</button>
            </div>
          </>
        ) : (
          <p className="muted">{job.notes || '-'}</p>
        )}
      </section>

      <section className="career-panel profile-form">
        <div className="panel-title-row">
          <h2>{t('jobDescription')}</h2>
        </div>
        <textarea value={job.raw_job_description || ''} onChange={(e) => setJob({ ...job, raw_job_description: e.target.value })} aria-label={t('jobDescription')} />
        <button className="btn-text" onClick={saveJd}>{t('saveJob')}</button>
      </section>

      {parsed && (
        <section className="career-panel">
          <h2>{t('parsedJobProfile')}</h2>
          <p className="blueprint-summary">{parsed.summary}</p>
          <div className="profile-grid">
            <span>{t('company')}</span><strong>{parsed.company_name || '-'}</strong>
            <span>{t('role')}</span><strong>{parsed.role_title || '-'}</strong>
            <span>{t('location')}</span><strong>{parsed.location || '-'}</strong>
            <span>{t('term')}</span><strong>{parsed.term}</strong>
            <span>{t('domain')}</span><strong>{parsed.domain}</strong>
            <span>{t('techStack')}</span><Tags items={allTech} />
          </div>
          <div className="blueprint-grid">
            <ListBlock title={t('requirements')} items={parsed.required_skills} />
            <ListBlock title={t('responsibilities')} items={parsed.responsibilities} />
            <ListBlock title={t('niceToHave')} items={parsed.nice_to_have} />
            <ListBlock title={t('riskFlags')} items={parsed.risk_flags} />
            <ListBlock title={t('workAuthorizationSignals')} items={parsed.work_authorization_signals} />
            <ListBlock title={t('applicationRequirements')} items={parsed.application_requirements} />
          </div>
        </section>
      )}

      {fit && (
        <section className="career-panel">
          <h2>{t('fitBreakdown')}</h2>
          <p className="blueprint-summary">{fit.summary}</p>
          <div className="scorecard-dims">
            {Object.entries(fit.breakdown || {}).map(([key, value]) => (
              <div className="scorecard-dim" key={key}>
                <div className="scorecard-dim-header">
                  <span className="scorecard-dim-label">{key.replace(/_/g, ' ')}</span>
                  <span className="scorecard-dim-score">{value}/100</span>
                </div>
                <div className="scorecard-bar-bg"><div className="scorecard-bar-fill" style={{ width: `${value}%`, backgroundColor: 'var(--easy)' }} /></div>
              </div>
            ))}
          </div>
          <div className="blueprint-grid">
            <ListBlock title={t('matchedStrengths')} items={fit.matched_strengths} />
            <ListBlock title={t('gaps')} items={fit.gaps} />
            <ListBlock title={t('resumeKeywords')} items={fit.recommended_resume_keywords} />
            <ListBlock title={t('projectsToHighlight')} items={fit.recommended_projects_to_highlight} />
          </div>
        </section>
      )}

      <section className="career-panel">
        <h2>{t('originalJd')}</h2>
        <pre className="jd-pre">{job.raw_job_description || t('needsJd')}</pre>
      </section>

      {/* Danger zone */}
      <section className="career-panel danger-zone">
        {deleteConfirming ? (
          <div className="confirm-dialog">
            <p>{t('deleteConfirm')}</p>
            <div className="confirm-actions">
              <button className="btn-text" onClick={() => setDeleteConfirming(false)}>{t('cancel')}</button>
              <button className="btn-danger" onClick={handleDelete}>{t('deleteJob')}</button>
            </div>
          </div>
        ) : (
          <button className="btn-text danger-text" onClick={() => setDeleteConfirming(true)}>
            {t('deleteJob')}
          </button>
        )}
      </section>
    </div>
  );
}
