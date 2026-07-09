import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LanguageControls from '../components/LanguageControls';
import MainNav from '../components/MainNav';
import BackLink from '../components/ui/BackLink';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';
import CopyButton from '../components/ui/CopyButton';
import { getCandidateProfile, listCareerJobs, type CandidateProfile, type CareerJob } from '../lib/api';
import { useI18n } from '../i18n/useI18n';

function Tags({ items }: { items: string[] }) {
  return <div className="tag-list">{items.length ? items.map((item) => <span className="tag" key={item}>{item}</span>) : <span className="muted">-</span>}</div>;
}

function SearchQueryGenerator() {
  const { t } = useI18n();
  const [role, setRole] = useState('Software Engineer Intern');
  const [location, setLocation] = useState('Canada');
  const [term, setTerm] = useState('Summer 2027');
  const [domain, setDomain] = useState('backend');
  const [remote, setRemote] = useState('Remote Canada');
  const [keywords, setKeywords] = useState('React Python AWS');

  const queries = useMemo(() => {
    const core = `"${role}" "${location}" "${term}"`;
    const extra = [domain, remote, keywords].filter(Boolean).join(' ');
    return [
      { label: 'Google', query: `${core} ${extra}`.trim(), google: true },
      { label: 'Greenhouse', query: `site:greenhouse.io "${role}" "${location}"` },
      { label: 'Lever', query: `site:lever.co "${role}" "${location}"` },
      { label: 'LinkedIn', query: `"${role}" "${location}" internship ${term}` },
      { label: 'Indeed', query: `"${role}" "${location}" co-op internship` },
      { label: 'Company Careers', query: `"${role}" "${location}" "careers"` },
      { label: 'Wellfound', query: `"${role}" startup "${location}"` },
      { label: 'Job Bank', query: `"${role}" "Job Bank" "${location}"` },
      { label: 'University Portal', query: 'Check WaterlooWorks, Western Connect, and your university career portal manually.' },
    ];
  }, [domain, keywords, location, remote, role, term]);

  return (
    <section className="career-panel">
      <h2>{t('searchQueryGenerator')}</h2>
      <div className="career-search-grid">
        <input id="sq-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder={t('targetRole')} aria-label={t('targetRole')} />
        <input id="sq-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('location')} aria-label={t('location')} />
        <input id="sq-term" value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('term')} aria-label={t('term')} />
        <input id="sq-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder={t('domain')} aria-label={t('domain')} />
        <input id="sq-remote" value={remote} onChange={(e) => setRemote(e.target.value)} placeholder={t('remotePreference')} aria-label={t('remotePreference')} />
        <input id="sq-keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder={t('keywords')} aria-label={t('keywords')} />
      </div>
      <div className="query-list">
        {queries.map((q) => (
          <div className="query-row" key={q.label}>
            <strong>{q.label}</strong>
            <code>{q.query}</code>
            <CopyButton text={q.query} label={t('copy')} copiedLabel={t('copied')} />
            {q.google && <a className="btn-text small" href={`https://www.google.com/search?q=${encodeURIComponent(q.query)}`} target="_blank" rel="noreferrer">{t('openGoogleSearch')}</a>}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function CareerHome() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [jobs, setJobs] = useState<CareerJob[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [profileError, setProfileError] = useState(false);

  useEffect(() => {
    getCandidateProfile()
      .then(setProfile)
      .catch(() => setProfileError(true))
      .finally(() => setLoadingProfile(false));
    listCareerJobs()
      .then(setJobs)
      .catch(console.error)
      .finally(() => setLoadingJobs(false));
  }, []);

  const recentJobs = jobs.slice(0, 6);
  const hasProfile = profile && (
    (profile.target_roles && profile.target_roles.length > 0) ||
    (profile.target_locations && profile.target_locations.length > 0)
  );

  return (
    <div className="career-page">
      <header className="home-header">
        <div className="logo-area">
          <h1 className="wordmark">{t('careerMode')}</h1>
          <p className="tagline">{t('internshipRadar')}</p>
        </div>
        <MainNav />
      </header>
      <LanguageControls />

      <div className="career-actions">
        <button className="btn-filled" onClick={() => navigate('/career/jobs/new')} id="career-add-job">
          {t('addJob')}
        </button>
        <button className="btn-text" onClick={() => navigate('/career/jobs')}>
          {t('savedJobs')}
        </button>
        <button className="btn-text" onClick={() => navigate('/career/profile')}>
          {t('editProfile')}
        </button>
      </div>

      <section className="career-panel">
        <div className="panel-title-row">
          <h2>{t('profileSummary')}</h2>
          <button className="btn-text small" onClick={() => navigate('/career/profile')}>{t('editProfile')}</button>
        </div>
        {loadingProfile ? (
          <LoadingSpinner message={t('loadingProfile')} inline />
        ) : profileError ? (
          <ErrorState message={t('failedToLoadProfile')} />
        ) : !hasProfile ? (
          <EmptyState
            message={t('noProfileYet')}
            action={{ label: t('setupProfile'), onClick: () => navigate('/career/profile') }}
          />
        ) : (
          <div className="profile-grid">
            <span>{t('targetRoles')}</span><Tags items={profile?.target_roles || []} />
            <span>{t('targetLocations')}</span><Tags items={profile?.target_locations || []} />
            <span>{t('skills')}</span><Tags items={Object.values(profile?.skills || {}).flat()} />
          </div>
        )}
      </section>

      <section className="career-panel">
        <div className="panel-title-row">
          <h2>{t('savedJobs')}</h2>
          <button className="btn-text small" onClick={() => navigate('/career/jobs')}>{t('view')}</button>
        </div>
        {loadingJobs ? (
          <LoadingSpinner message={t('loadingJobs')} inline />
        ) : recentJobs.length ? (
          <div className="career-job-list">
            {recentJobs.map((job) => (
              <div
                className="career-job-row"
                key={job.id}
                onClick={() => navigate(`/career/jobs/${job.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/career/jobs/${job.id}`)}
                aria-label={`${job.company_name || '-'} - ${job.role_title || t('needsJd')}`}
              >
                <strong>{job.company_name || '-'}</strong>
                <span>{job.role_title || t('needsJd')}</span>
                <span>{job.location || '-'}</span>
                <span>{job.fit_score !== null ? `${job.fit_score}/100` : '-'}</span>
                <span>{job.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            message={t('noJobsYet')}
            action={{ label: t('addJob'), onClick: () => navigate('/career/jobs/new') }}
          />
        )}
      </section>

      <SearchQueryGenerator />
    </div>
  );
}
