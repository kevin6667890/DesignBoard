import { useState, useEffect } from 'react';
import HistoryTable from '../components/HistoryTable';
import MainNav from '../components/MainNav';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorState from '../components/ui/ErrorState';
import type { SessionData } from '../lib/api';
import { listSessions } from '../lib/api';
import { useI18n } from '../i18n/useI18n';

export default function History() {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { t } = useI18n();

  const loadSessions = () => {
    setLoading(true);
    setError(false);
    listSessions()
      .then(setSessions)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadSessions(); }, []);

  return (
    <div className="history-page">
      <header className="history-header">
        <div className="logo-area">
          <h1 className="wordmark">{t('designBoard')}</h1>
          <p className="tagline">{t('pastInterviews')}</p>
        </div>
        <MainNav />
      </header>

      <div className="history-content">
        <h2 className="history-title">{t('pastInterviews')}</h2>
        {loading ? (
          <LoadingSpinner message={t('loadingHistory')} />
        ) : error ? (
          <ErrorState message={t('failedToLoadHistory')} onRetry={loadSessions} retryLabel={t('tryAgain')} />
        ) : (
          <HistoryTable sessions={sessions} />
        )}
      </div>
    </div>
  );
}
