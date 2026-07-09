import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LanguageControls from '../components/LanguageControls';
import MainNav from '../components/MainNav';
import BackLink from '../components/ui/BackLink';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { createCareerJob } from '../lib/api';
import { useI18n } from '../i18n/useI18n';

export default function CareerJobForm() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    company_name: '',
    role_title: '',
    location: '',
    job_url: '',
    application_url: '',
    source: 'Manual',
    raw_job_description: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  // A job can be saved URL-only — no JD required
  const canSave = form.company_name.trim() || form.role_title.trim() || form.job_url.trim();
  const hasJd = form.raw_job_description.trim().length > 0;

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const job = await createCareerJob({
        ...form,
        status: 'saved',
        priority: 'unknown',
      });
      navigate(`/career/jobs/${job.id}`);
    } catch (err) {
      console.error(err);
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="career-page">
      <header className="home-header">
        <div className="logo-area">
          <h1 className="wordmark">{t('addJob')}</h1>
          <p className="tagline">{t('rawLeadHelp')}</p>
        </div>
        <MainNav />
      </header>
      <LanguageControls />

      <div className="page-back-row">
        <BackLink to="/career" label={t('backToCareerMode')} />
      </div>

      <section className="career-panel profile-form">
        {!hasJd && (
          <div className="info-banner" role="note">
            {t('noJdWarning')}
          </div>
        )}

        <div className="career-search-grid">
          <label htmlFor="job-company" className="field-label">
            {t('company')}
            <input
              id="job-company"
              value={form.company_name}
              onChange={(e) => update('company_name', e.target.value)}
              placeholder={t('companyNameOptional')}
            />
          </label>
          <label htmlFor="job-role" className="field-label">
            {t('role')}
            <input
              id="job-role"
              value={form.role_title}
              onChange={(e) => update('role_title', e.target.value)}
              placeholder={t('roleTitleOptional')}
            />
          </label>
          <label htmlFor="job-location" className="field-label">
            {t('location')}
            <input
              id="job-location"
              value={form.location}
              onChange={(e) => update('location', e.target.value)}
              placeholder={t('location')}
            />
          </label>
          <label htmlFor="job-source" className="field-label">
            {t('source')}
            <input
              id="job-source"
              value={form.source}
              onChange={(e) => update('source', e.target.value)}
              placeholder={t('source')}
            />
          </label>
          <label htmlFor="job-url" className="field-label">
            {t('jobUrl')}
            <input
              id="job-url"
              type="url"
              value={form.job_url}
              onChange={(e) => update('job_url', e.target.value)}
              placeholder="https://..."
            />
          </label>
          <label htmlFor="app-url" className="field-label">
            {t('applicationUrl')}
            <input
              id="app-url"
              type="url"
              value={form.application_url}
              onChange={(e) => update('application_url', e.target.value)}
              placeholder="https://..."
            />
          </label>
        </div>

        <label htmlFor="job-jd" className="field-label">
          {t('jobDescription')} <span className="optional-mark">({t('companyNameOptional').split('(')[1]?.replace(')', '') || 'optional'})</span>
        </label>
        <textarea
          id="job-jd"
          value={form.raw_job_description}
          onChange={(e) => update('raw_job_description', e.target.value)}
          placeholder={t('pasteJobDescription')}
        />

        <label htmlFor="job-notes" className="field-label">
          {t('notes')}
        </label>
        <textarea
          id="job-notes"
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
        />

        {saveError && <p className="form-error" role="alert">{saveError}</p>}

        <div className="form-actions">
          <button
            className="btn-filled"
            onClick={handleSave}
            disabled={saving || !canSave}
            aria-disabled={saving || !canSave}
            title={!canSave ? 'Enter at least a company name, role, or URL' : undefined}
          >
            {saving ? <LoadingSpinner inline message={t('loading')} /> : t('saveJob')}
          </button>
          <button className="btn-text" onClick={() => navigate('/career')}>
            {t('cancel')}
          </button>
        </div>
      </section>
    </div>
  );
}
