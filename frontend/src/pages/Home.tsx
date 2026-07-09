import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LanguageControls from '../components/LanguageControls';
import QuestionGrid from '../components/QuestionGrid';
import type { Question, SessionData } from '../lib/api';
import { getQuestions, listSessions } from '../lib/api';
import { useI18n } from '../i18n/useI18n';

type DifficultyFilter = 'All' | 'Easy' | 'Medium' | 'Hard';

function formatDate(iso: string | null, language: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', {
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
  const { t, uiLanguage } = useI18n();

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
  const filterLabel = (f: DifficultyFilter) => {
    if (f === 'All') return t('all');
    if (f === 'Easy') return t('easy');
    if (f === 'Medium') return t('medium');
    return t('hard');
  };

  return (
    <div className="home">
      <header className="home-header">
        <div className="logo-area">
          <h1 className="wordmark">{t('designBoard')}</h1>
          <p className="tagline">{t('systemDesignPractice')}</p>
        </div>
        <nav className="nav-links">
          <button className="btn-text" onClick={() => navigate('/history')}>
            {t('history')} -&gt;
          </button>
        </nav>
      </header>

      <LanguageControls />

      <section className="custom-entry">
        <div>
          <h2>{t('customInterviewFromJd')}</h2>
          <p>{t('pasteJobDescription')}</p>
        </div>
        <button className="btn-filled" onClick={() => navigate('/custom')}>
          {t('generateInterviewPlan')}
        </button>
      </section>

      <div className="filter-tabs" aria-label={t('difficulty')}>
        {filters.map((f) => (
          <button
            key={f}
            className={`filter-tab ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {filterLabel(f)}
          </button>
        ))}
      </div>

      <QuestionGrid questions={filtered} />

      {recentSessions.length > 0 && (
        <section className="recent-sessions">
          <h2 className="recent-title">{t('recentSessions')}</h2>
          <table className="recent-table">
            <thead>
              <tr>
                <th>{t('date')}</th>
                <th>{t('question')}</th>
                <th>{t('type')}</th>
                <th>{t('score')}</th>
              </tr>
            </thead>
            <tbody>
              {recentSessions.map((s) => (
                <tr
                  key={s.id}
                  className="recent-row"
                  onClick={() => navigate(`/interview/${s.id}`)}
                >
                  <td>{formatDate(s.started_at, uiLanguage)}</td>
                  <td>{s.custom_question_title || s.question_title}</td>
                  <td>{s.session_type === 'jd_tailored' ? t('jdTailored') : t('builtIn')}</td>
                  <td>
                    {s.status === 'completed' ? (
                      <ScoreDot total={s.score_total} />
                    ) : (
                      <span className="status-active">{t('inProgress')}</span>
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
