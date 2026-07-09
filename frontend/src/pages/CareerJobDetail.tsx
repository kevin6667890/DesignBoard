import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LanguageControls from '../components/LanguageControls';
import MainNav from '../components/MainNav';
import {
  getCareerJob,
  parseCareerJob,
  prepareCareerInterview,
  scoreCareerJob,
  updateCareerJob,
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
  const { t, interviewLanguage } = useI18n();
  const navigate = useNavigate();
  const [job, setJob] = useState<CareerJob | null>(null);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    if (!jobId) return;
    getCareerJob(Number(jobId)).then(setJob).catch(console.error);
  };

  useEffect(load, [jobId]);

  const refreshWith = (promise: Promise<CareerJob>, label: string) => {
    setWorking(label);
    setError('');
    promise.then(setJob).catch((err) => setError(err instanceof Error ? err.message : String(err))).finally(() => setWorking(''));
  };

  const handlePrepare = async () => {
    if (!job) return;
    if (!job.raw_job_description?.trim()) {
      setError(t('addJdBeforeInterview'));
      return;
    }
    setWorking(t('prepareInterview'));
    try {
      const result = await prepareCareerInterview(job.id, interviewLanguage);
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

  if (!job) {
    return <div className="interview-loading">{t('loading')}</div>;
  }

  const parsed = job.parsed_job;
  const fit = job.fit_breakdown;
  const allTech = parsed ? Object.values(parsed.tech_stack || {}).flat() : [];

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

      <section className="career-panel">
        <div className="panel-title-row">
          <div>
            <h2>{job.role_title || t('needsJd')}</h2>
            <p className="muted">{job.location || '-'} · {job.source || '-'}</p>
          </div>
          <div className="career-actions">
            <button className="btn-text" onClick={() => refreshWith(parseCareerJob(job.id, interviewLanguage), t('parseJd'))} disabled={!!working}>{t('parseJd')}</button>
            <button className="btn-text" onClick={() => refreshWith(scoreCareerJob(job.id, interviewLanguage), t('generateFitScore'))} disabled={!!working}>{t('generateFitScore')}</button>
            <button className="btn-filled" onClick={handlePrepare} disabled={!!working}>{t('prepareInterview')}</button>
          </div>
        </div>
        {working && <p className="loading-text">{working}...</p>}
        {error && <p className="form-error">{error}</p>}
        <div className="profile-grid">
          <span>{t('status')}</span><strong>{job.status}</strong>
          <span>{t('priority')}</span><strong>{job.priority}</strong>
          <span>{t('fitScore')}</span><strong>{job.fit_score !== null ? `${job.fit_score}/100` : '-'}</strong>
          <span>{t('nextAction')}</span><strong>{fit?.next_action || '-'}</strong>
        </div>
        {job.application_url && <a className="btn-text" href={job.application_url} target="_blank" rel="noreferrer">{t('openApplication')}</a>}
      </section>

      <section className="career-panel profile-form">
        <h2>{t('jobDescription')}</h2>
        <textarea value={job.raw_job_description || ''} onChange={(e) => setJob({ ...job, raw_job_description: e.target.value })} />
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
    </div>
  );
}
