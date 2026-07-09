import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LanguageControls from '../components/LanguageControls';
import MainNav from '../components/MainNav';
import BackLink from '../components/ui/BackLink';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorState from '../components/ui/ErrorState';
import { listCareerJobs, updateCareerJob, type CareerJob, type CareerJobPriority, type CareerJobStatus } from '../lib/api';
import { useI18n } from '../i18n/useI18n';

const statuses: CareerJobStatus[] = ['saved', 'ready_to_apply', 'applied', 'oa', 'interview', 'rejected', 'offer', 'archived'];
const priorities: CareerJobPriority[] = ['high', 'medium', 'low', 'unknown'];

export default function CareerJobs() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<CareerJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('date');

  const load = () => {
    setLoading(true);
    setLoadError(false);
    listCareerJobs()
      .then(setJobs)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  };
  useEffect(() => { void load(); }, []);

  const sources = useMemo(() => Array.from(new Set(jobs.map((job) => job.source).filter(Boolean))) as string[], [jobs]);
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    const items = jobs.filter((job) => {
      const text = `${job.company_name || ''} ${job.role_title || ''}`.toLowerCase();
      return (statusFilter === 'all' || job.status === statusFilter)
        && (priorityFilter === 'all' || job.priority === priorityFilter)
        && (sourceFilter === 'all' || job.source === sourceFilter)
        && (!q || text.includes(q));
    });
    return items.sort((a, b) => {
      if (sort === 'fit') return (b.fit_score ?? -1) - (a.fit_score ?? -1);
      if (sort === 'status') return a.status.localeCompare(b.status);
      return new Date(b.updated_at || b.created_at || '').getTime() - new Date(a.updated_at || a.created_at || '').getTime();
    });
  }, [jobs, priorityFilter, query, sort, sourceFilter, statusFilter]);

  const quickUpdate = async (job: CareerJob, patch: Partial<CareerJob>) => {
    const updated = await updateCareerJob(job.id, { ...job, ...patch });
    setJobs((current) => current.map((item) => item.id === updated.id ? updated : item));
  };

  const hasActiveFilter = statusFilter !== 'all' || priorityFilter !== 'all' || sourceFilter !== 'all' || query !== '';

  const clearFilters = () => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setSourceFilter('all');
    setQuery('');
  };

  return (
    <div className="career-page">
      <header className="home-header">
        <div className="logo-area">
          <h1 className="wordmark">{t('savedJobs')}</h1>
          <p className="tagline">{t('internshipRadar')}</p>
        </div>
        <MainNav />
      </header>
      <LanguageControls />

      <div className="page-back-row">
        <BackLink to="/career" label={t('backToCareerMode')} />
      </div>

      <div className="career-actions">
        <button className="btn-filled" id="add-job-btn" onClick={() => navigate('/career/jobs/new')}>{t('addJob')}</button>
      </div>

      <section className="career-panel">
        <div className="career-search-grid">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchJobs')}
            aria-label={t('searchJobs')}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label={t('status')}>
            <option value="all">{t('status')}: {t('all')}</option>
            {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} aria-label={t('priority')}>
            <option value="all">{t('priority')}: {t('all')}</option>
            {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
          </select>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} aria-label={t('source')}>
            <option value="all">{t('source')}: {t('all')}</option>
            {sources.map((source) => <option key={source} value={source}>{source}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t('sort')}>
            <option value="date">{t('sort')}: {t('date')}</option>
            <option value="fit">{t('sort')}: {t('fitScore')}</option>
            <option value="status">{t('sort')}: {t('status')}</option>
          </select>
          {hasActiveFilter && (
            <button className="btn-text small" onClick={clearFilters}>
              {t('clearFilters')}
            </button>
          )}
        </div>
      </section>

      <section className="career-panel">
        {loading ? (
          <LoadingSpinner message={t('loadingJobs')} />
        ) : loadError ? (
          <ErrorState message={t('failedToLoadJobs')} onRetry={load} retryLabel={t('tryAgain')} />
        ) : jobs.length === 0 ? (
          <EmptyState
            message={t('noJobsYet')}
            action={{ label: t('addJob'), onClick: () => navigate('/career/jobs/new') }}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            message={t('noMatchingJobs')}
            action={{ label: t('clearFilters'), onClick: clearFilters }}
          />
        ) : (
          <div className="career-table">
            <div className="career-table-head" role="row">
              <span>{t('company')}</span><span>{t('role')}</span><span>{t('location')}</span><span>{t('source')}</span><span>{t('status')}</span><span>{t('fitScore')}</span><span>{t('priority')}</span><span>{t('notes')}</span>
            </div>
            {filtered.map((job) => (
              <div className="career-table-row" key={job.id} role="row">
                <button className="btn-text" onClick={() => navigate(`/career/jobs/${job.id}`)}>{job.company_name || '-'}</button>
                <span>{job.role_title || t('needsJd')}</span>
                <span>{job.location || '-'}</span>
                <span>{job.source || '-'}</span>
                <select
                  value={job.status}
                  onChange={(e) => quickUpdate(job, { status: e.target.value as CareerJobStatus })}
                  aria-label={`${t('status')} for ${job.company_name || job.role_title}`}
                >
                  {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <span>{job.fit_score !== null ? `${job.fit_score}/100` : '-'}</span>
                <span>{job.priority}</span>
                <input
                  value={job.notes || ''}
                  onChange={(e) => quickUpdate(job, { notes: e.target.value })}
                  aria-label={`${t('notes')} for ${job.company_name || job.role_title}`}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
