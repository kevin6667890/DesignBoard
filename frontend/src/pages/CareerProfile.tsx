import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LanguageControls from '../components/LanguageControls';
import MainNav from '../components/MainNav';
import BackLink from '../components/ui/BackLink';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { analyzeResume, applyResumeAnalysis, getCandidateProfile, saveCandidateProfile, type CandidateProfile, type ResumeAnalysisResponse } from '../lib/api';
import { useI18n } from '../i18n/useI18n';

const split = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
const join = (items?: string[]) => (items || []).join(', ');

const emptyProfile: Omit<CandidateProfile, 'id' | 'created_at' | 'updated_at'> = {
  name: '',
  target_roles: [],
  target_locations: [],
  education: {},
  work_authorization_notes: '',
  skills: {
    languages: [],
    frontend: [],
    backend: [],
    databases: [],
    cloud_devops: [],
    ai_tools: [],
    testing: [],
    other: [],
  },
  projects: [],
  preferences: {},
};

export default function CareerProfile() {
  const { t, uiLanguage } = useI18n();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(emptyProfile);
  const [projectText, setProjectText] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState('');
  const [resumeAnalysis, setResumeAnalysis] = useState<ResumeAnalysisResponse | null>(null);
  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeError, setResumeError] = useState('');

  useEffect(() => {
    getCandidateProfile()
      .then((data) => {
        setProfile({
          name: data.name || '',
          target_roles: data.target_roles || [],
          target_locations: data.target_locations || [],
          education: data.education || {},
          work_authorization_notes: data.work_authorization_notes || '',
          skills: { ...emptyProfile.skills, ...(data.skills || {}) },
          projects: data.projects || [],
          preferences: data.preferences || {},
        });
        setProjectText((data.projects || []).map((p) => `${p.name || ''} | ${p.description || ''} | ${Array.isArray(p.tech_stack) ? p.tech_stack.join(', ') : ''}`).join('\n'));
      })
      .catch(console.error);
  }, []);

  const setEducation = (key: string, value: string) => {
    setProfile((current) => ({ ...current, education: { ...current.education, [key]: value } }));
  };

  const setSkills = (key: string, value: string) => {
    setProfile((current) => ({ ...current, skills: { ...current.skills, [key]: split(value) } }));
  };

  const setPreferences = (key: string, value: string) => {
    setProfile((current) => ({ ...current, preferences: { ...current.preferences, [key]: key.includes('domains') ? split(value) : value } }));
  };

  const parseProjects = () => projectText.split('\n').map((line) => {
    const [name, description, tech] = line.split('|').map((part) => part.trim());
    return name ? { name, description: description || '', tech_stack: split(tech || ''), relevance_tags: [] } : null;
  }).filter(Boolean) as Array<Record<string, unknown>>;

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    setSaveError('');
    try {
      const saved = await saveCandidateProfile({ ...profile, projects: parseProjects() });
      setProfile({
        name: saved.name || '',
        target_roles: saved.target_roles,
        target_locations: saved.target_locations,
        education: saved.education,
        work_authorization_notes: saved.work_authorization_notes,
        skills: { ...emptyProfile.skills, ...saved.skills },
        projects: saved.projects,
        preferences: saved.preferences,
      });
      setMessage(t('profileSaved'));
      // Auto-clear message after 3 seconds
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const analyzeImportedResume = async () => {
    if (!resumeFile && !resumeText.trim()) { setResumeError(t('resumeInputRequired')); return; }
    setResumeBusy(true); setResumeError(''); setMessage('');
    try { setResumeAnalysis(await analyzeResume({ resumeFile, resumeText, outputLanguage: uiLanguage })); }
    catch (err) { setResumeError(err instanceof Error && err.message.includes('Could not extract text from PDF') ? t('pdfExtractionFailed') : (err instanceof Error ? err.message : String(err))); }
    finally { setResumeBusy(false); }
  };

  const applyImportedResume = async (mergeMode: 'replace' | 'merge') => {
    if (!resumeAnalysis) return;
    setResumeBusy(true); setResumeError('');
    try {
      const saved = await applyResumeAnalysis(resumeAnalysis.resume_profile, mergeMode);
      setProfile({ name: saved.name || '', target_roles: saved.target_roles || [], target_locations: saved.target_locations || [], education: saved.education || {}, work_authorization_notes: saved.work_authorization_notes || '', skills: { ...emptyProfile.skills, ...(saved.skills || {}) }, projects: saved.projects || [], preferences: saved.preferences || {} });
      setProjectText((saved.projects || []).map((p) => `${p.name || ''} | ${p.description || ''} | ${Array.isArray(p.tech_stack) ? p.tech_stack.join(', ') : ''}`).join('\n'));
      setMessage(t('resumeApplied'));
    } catch (err) { setResumeError(err instanceof Error ? err.message : String(err)); }
    finally { setResumeBusy(false); }
  };

  return (
    <div className="career-page">
      <header className="home-header">
        <div className="logo-area">
          <h1 className="wordmark">{t('candidateProfile')}</h1>
          <p className="tagline">{t('rawLeadHelp')}</p>
        </div>
        <MainNav />
      </header>
      <LanguageControls />

      <div className="page-back-row">
        <BackLink to="/career" label={t('backToCareerMode')} />
      </div>

      <section className="career-panel profile-form">
        <h2>{t('resumeImport')}</h2>
        <label htmlFor="resume-file">{t('uploadResumePdf')}</label>
        <input id="resume-file" type="file" accept="application/pdf,.pdf" onChange={(e) => setResumeFile(e.target.files?.[0] || null)} />
        <label htmlFor="resume-text">{t('pasteResumeText')}</label>
        <textarea id="resume-text" value={resumeText} onChange={(e) => setResumeText(e.target.value)} aria-label={t('pasteResumeText')} />
        <button className="btn-filled" onClick={analyzeImportedResume} disabled={resumeBusy}>{resumeBusy ? t('analyzingResume') : t('analyzeResume')}</button>
        {resumeError && <p className="form-error" role="alert">{resumeError}</p>}
        {resumeAnalysis && <div className="resume-preview">
          <h3>{t('extractedProfile')}</h3><p className="blueprint-summary">{resumeAnalysis.profile_summary}</p>
          <ListPreview title={t('education')} items={Object.values(resumeAnalysis.resume_profile.education).filter(Boolean).map(String)} />
          <ListPreview title={t('suggestedJobTitles')} items={resumeAnalysis.resume_profile.suggested_job_titles} />
          <ListPreview title={t('targetLocations')} items={resumeAnalysis.resume_profile.target_locations} />
          <ListPreview title={t('skills')} items={Object.values(resumeAnalysis.resume_profile.skills).flat()} />
          <ListPreview title={t('projects')} items={resumeAnalysis.resume_profile.projects.map((p) => String(p.name || ''))} />
          <ListPreview title={t('strengths')} items={resumeAnalysis.resume_profile.strengths} />
          <ListPreview title={t('gaps')} items={resumeAnalysis.resume_profile.gaps} />
          <ListPreview title={t('searchKeywords')} items={resumeAnalysis.resume_profile.search_keywords} />
          <div className="career-actions"><button className="btn-filled" onClick={() => applyImportedResume('replace')} disabled={resumeBusy}>{t('applyToProfile')}</button><button className="btn-text" onClick={() => applyImportedResume('merge')} disabled={resumeBusy}>{t('mergeIntoExistingProfile')}</button><button className="btn-text" onClick={() => setResumeAnalysis(null)}>{t('discard')}</button><button className="btn-text" onClick={() => navigate('/career/search-agent')}>{t('useInSearchAgent')}</button></div>
        </div>}
      </section>

      <section className="career-panel profile-form">
        <label htmlFor="target-roles">{t('targetRoles')}</label>
        <input
          id="target-roles"
          value={join(profile.target_roles)}
          onChange={(e) => setProfile({ ...profile, target_roles: split(e.target.value) })}
          placeholder="Software Engineer Intern, Backend Intern"
        />
        <label htmlFor="target-locations">{t('targetLocations')}</label>
        <input
          id="target-locations"
          value={join(profile.target_locations)}
          onChange={(e) => setProfile({ ...profile, target_locations: split(e.target.value) })}
          placeholder="Toronto, Waterloo, Remote Canada"
        />

        <h2>{t('education')}</h2>
        <div className="career-search-grid">
          <input value={String(profile.education.school || '')} onChange={(e) => setEducation('school', e.target.value)} placeholder={t('school')} aria-label={t('school')} />
          <input value={String(profile.education.degree || '')} onChange={(e) => setEducation('degree', e.target.value)} placeholder={t('degree')} aria-label={t('degree')} />
          <input value={String(profile.education.major || '')} onChange={(e) => setEducation('major', e.target.value)} placeholder={t('major')} aria-label={t('major')} />
          <input value={String(profile.education.graduation_year || '')} onChange={(e) => setEducation('graduation_year', e.target.value)} placeholder={t('graduationYear')} aria-label={t('graduationYear')} />
          <input value={String(profile.education.year_level || '')} onChange={(e) => setEducation('year_level', e.target.value)} placeholder={t('yearLevel')} aria-label={t('yearLevel')} />
        </div>

        <label htmlFor="work-auth">{t('workAuthorizationNotes')}</label>
        <textarea
          id="work-auth"
          value={profile.work_authorization_notes || ''}
          onChange={(e) => setProfile({ ...profile, work_authorization_notes: e.target.value })}
        />

        <h2>{t('skills')}</h2>
        <div className="career-search-grid">
          {[
            ['languages', t('languages')],
            ['frontend', t('frontend')],
            ['backend', t('backend')],
            ['databases', t('databases')],
            ['cloud_devops', t('cloudDevops')],
            ['ai_tools', t('aiTools')],
            ['testing', t('testing')],
            ['other', t('other')],
          ].map(([key, label]) => (
            <input
              key={key}
              aria-label={label}
              value={join(profile.skills[key] || [])}
              onChange={(e) => setSkills(key, e.target.value)}
              placeholder={label}
            />
          ))}
        </div>

        <h2>{t('projects')}</h2>
        <label htmlFor="projects-textarea" className="field-label muted">
          name | description | tech stack (comma separated), one per line
        </label>
        <textarea
          id="projects-textarea"
          value={projectText}
          onChange={(e) => setProjectText(e.target.value)}
          placeholder="Project name | description | React, FastAPI, SQLite"
        />

        <h2>{t('preferences')}</h2>
        <div className="career-search-grid">
          <input value={join(profile.preferences.preferred_domains as string[])} onChange={(e) => setPreferences('preferred_domains', e.target.value)} placeholder={t('preferredDomains')} aria-label={t('preferredDomains')} />
          <input value={join(profile.preferences.avoid_domains as string[])} onChange={(e) => setPreferences('avoid_domains', e.target.value)} placeholder={t('avoidDomains')} aria-label={t('avoidDomains')} />
          <input value={String(profile.preferences.company_size_preference || '')} onChange={(e) => setPreferences('company_size_preference', e.target.value)} placeholder={t('companySizePreference')} aria-label={t('companySizePreference')} />
          <input value={String(profile.preferences.remote_preference || '')} onChange={(e) => setPreferences('remote_preference', e.target.value)} placeholder={t('remotePreference')} aria-label={t('remotePreference')} />
        </div>

        {message && <p className="form-success" role="status" aria-live="polite">{message}</p>}
        {saveError && <p className="form-error" role="alert">{saveError}</p>}
        <button className="btn-filled" onClick={handleSave} disabled={saving}>
          {saving ? <LoadingSpinner inline message={t('loading')} /> : t('saveProfile')}
        </button>
      </section>
    </div>
  );
}

function ListPreview({ title, items }: { title: string; items: string[] }) {
  return <div><strong>{title}</strong><p className="muted">{items.length ? items.join(', ') : '-'}</p></div>;
}
