import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import QuestionGrid from '../components/QuestionGrid';
import type { Question, SessionData } from '../lib/api';
import { getQuestions, listSessions } from '../lib/api';

type DifficultyFilter = 'All' | 'Easy' | 'Medium' | 'Hard';

const difficultyColor: Record<string, string> = {
  Easy: 'var(--easy)',
  Medium: 'var(--medium)',
  Hard: 'var(--hard)',
};

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function ScoreDot({ total }: { total: number | null }) {
  const score = total ?? 0;
  let color = 'var(--hard)';
  if (score >= 35) color = 'var(--easy)';
  else if (score >= 25) color = 'var(--medium)';
  return (
    <span className="score-chip">
      <span className="score-dot" style={{ backgroundColor: color }} />
      {score}/50
    </span>
  );
}

export default function Home() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [filter, setFilter] = useState<DifficultyFilter>('All');
  const [recentSessions, setRecentSessions] = useState<SessionData[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    getQuestions().then(setQuestions).catch(console.error);
    listSessions()
      .then((sessions) => setRecentSessions(sessions.slice(0, 5)))
      .catch(console.error);
  }, []);

  const filtered =
    filter === 'All'
      ? questions
      : questions.filter((q) => q.difficulty === filter);

  const filters: DifficultyFilter[] = ['All', 'Easy', 'Medium', 'Hard'];

  return (
    <div className="home">
      <header className="home-header">
        <div className="logo-area">
          <h1 className="wordmark">DesignBoard</h1>
          <p className="tagline">System Design Interview Simulator</p>
        </div>
        <nav className="nav-links">
          <button className="btn-text" onClick={() => navigate('/history')}>
            History →
          </button>
        </nav>
      </header>

      <div className="filter-tabs">
        {filters.map((f) => (
          <button
            key={f}
            className={`filter-tab ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <QuestionGrid questions={filtered} />

      {recentSessions.length > 0 && (
        <section className="recent-sessions">
          <h2 className="recent-title">Recent Sessions</h2>
          <table className="recent-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Question</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {recentSessions.map((s) => (
                <tr
                  key={s.id}
                  className="recent-row"
                  onClick={() => navigate(`/interview/${s.id}`)}
                >
                  <td>{formatDate(s.started_at)}</td>
                  <td>{s.question_title}</td>
                  <td>
                    {s.status === 'completed' ? (
                      <ScoreDot total={s.score_total} />
                    ) : (
                      <span className="status-active">In Progress</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
