import { useEffect, useState } from 'react';
import LanguageControls from '../components/LanguageControls';
import MainNav from '../components/MainNav';
import { getCandidateProfile, saveCandidateProfile, type CandidateProfile } from '../lib/api';
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
  const { t } = useI18n();
  const [profile, setProfile] = useState(emptyProfile);
  const [projectText, setProjectText] = useState('');
  const [message, setMessage] = useState('');

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

      <section className="career-panel profile-form">
        <label>{t('targetRoles')}<input value={join(profile.target_roles)} onChange={(e) => setProfile({ ...profile, target_roles: split(e.target.value) })} placeholder="Software Engineer Intern, Backend Intern" /></label>
        <label>{t('targetLocations')}<input value={join(profile.target_locations)} onChange={(e) => setProfile({ ...profile, target_locations: split(e.target.value) })} placeholder="Toronto, Waterloo, Remote Canada" /></label>

        <h2>{t('education')}</h2>
        <div className="career-search-grid">
          <input value={String(profile.education.school || '')} onChange={(e) => setEducation('school', e.target.value)} placeholder={t('school')} />
          <input value={String(profile.education.degree || '')} onChange={(e) => setEducation('degree', e.target.value)} placeholder={t('degree')} />
          <input value={String(profile.education.major || '')} onChange={(e) => setEducation('major', e.target.value)} placeholder={t('major')} />
          <input value={String(profile.education.graduation_year || '')} onChange={(e) => setEducation('graduation_year', e.target.value)} placeholder={t('graduationYear')} />
          <input value={String(profile.education.year_level || '')} onChange={(e) => setEducation('year_level', e.target.value)} placeholder={t('yearLevel')} />
        </div>

        <label>{t('workAuthorizationNotes')}<textarea value={profile.work_authorization_notes || ''} onChange={(e) => setProfile({ ...profile, work_authorization_notes: e.target.value })} /></label>

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
            <input key={key} value={join(profile.skills[key] || [])} onChange={(e) => setSkills(key, e.target.value)} placeholder={label} />
          ))}
        </div>

        <h2>{t('projects')}</h2>
        <textarea value={projectText} onChange={(e) => setProjectText(e.target.value)} placeholder="Project name | description | React, FastAPI, SQLite" />

        <h2>{t('preferences')}</h2>
        <div className="career-search-grid">
          <input value={join(profile.preferences.preferred_domains as string[])} onChange={(e) => setPreferences('preferred_domains', e.target.value)} placeholder={t('preferredDomains')} />
          <input value={join(profile.preferences.avoid_domains as string[])} onChange={(e) => setPreferences('avoid_domains', e.target.value)} placeholder={t('avoidDomains')} />
          <input value={String(profile.preferences.company_size_preference || '')} onChange={(e) => setPreferences('company_size_preference', e.target.value)} placeholder={t('companySizePreference')} />
          <input value={String(profile.preferences.remote_preference || '')} onChange={(e) => setPreferences('remote_preference', e.target.value)} placeholder={t('remotePreference')} />
        </div>

        {message && <p className="form-success">{message}</p>}
        <button className="btn-filled" onClick={handleSave}>{t('saveProfile')}</button>
      </section>
    </div>
  );
}
