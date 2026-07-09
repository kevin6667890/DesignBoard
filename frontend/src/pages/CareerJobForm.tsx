import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LanguageControls from '../components/LanguageControls';
import MainNav from '../components/MainNav';
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

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const job = await createCareerJob({
        ...form,
        status: 'saved',
        priority: 'unknown',
      });
      navigate(`/career/jobs/${job.id}`);
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

      <section className="career-panel profile-form">
        <div className="career-search-grid">
          <input value={form.company_name} onChange={(e) => update('company_name', e.target.value)} placeholder={t('companyNameOptional')} />
          <input value={form.role_title} onChange={(e) => update('role_title', e.target.value)} placeholder={t('roleTitleOptional')} />
          <input value={form.location} onChange={(e) => update('location', e.target.value)} placeholder={t('location')} />
          <input value={form.source} onChange={(e) => update('source', e.target.value)} placeholder={t('source')} />
          <input value={form.job_url} onChange={(e) => update('job_url', e.target.value)} placeholder={t('jobUrl')} />
          <input value={form.application_url} onChange={(e) => update('application_url', e.target.value)} placeholder={t('applicationUrl')} />
        </div>
        <label>{t('jobDescription')}<textarea value={form.raw_job_description} onChange={(e) => update('raw_job_description', e.target.value)} placeholder={t('pasteJobDescription')} /></label>
        <label>{t('notes')}<textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} /></label>
        <button className="btn-filled" onClick={handleSave} disabled={saving}>{saving ? t('loading') : t('saveJob')}</button>
      </section>
    </div>
  );
}
