import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HistoryTable from '../components/HistoryTable';
import type { SessionData } from '../lib/api';
import { listSessions } from '../lib/api';
import { useI18n } from '../i18n/useI18n';

export default function History() {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { t } = useI18n();

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="history-page">
      <header className="history-header">
        <div className="logo-area">
          <h1 className="wordmark">{t('designBoard')}</h1>
        </div>
        <nav className="nav-links">
          <button className="btn-text" onClick={() => navigate('/')}>
            &lt;- {t('home')}
          </button>
        </nav>
      </header>

      <div className="history-content">
        <h2 className="history-title">{t('pastInterviews')}</h2>
        {loading ? (
          <p className="loading-text">{t('loading')}</p>
        ) : (
          <HistoryTable sessions={sessions} />
        )}
      </div>
    </div>
  );
}
