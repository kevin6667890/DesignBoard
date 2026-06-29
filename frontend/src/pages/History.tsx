import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HistoryTable from '../components/HistoryTable';
import type { SessionData } from '../lib/api';
import { listSessions } from '../lib/api';

export default function History() {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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
          <h1 className="wordmark">DesignBoard</h1>
        </div>
        <nav className="nav-links">
          <button className="btn-text" onClick={() => navigate('/')}>
            ← Home
          </button>
        </nav>
      </header>

      <div className="history-content">
        <h2 className="history-title">Interview History</h2>
        {loading ? (
          <p className="loading-text">Loading...</p>
        ) : (
          <HistoryTable sessions={sessions} />
        )}
      </div>
    </div>
  );
}
