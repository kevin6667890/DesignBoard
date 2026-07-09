import { Fragment, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SessionData } from '../lib/api';
import { useI18n } from '../i18n/useI18n';

interface Props {
  sessions: SessionData[];
}

const difficultyColor: Record<string, string> = {
  Easy: 'var(--easy)',
  Medium: 'var(--medium)',
  Hard: 'var(--hard)',
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
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

function barColor(score: number): string {
  if (score >= 7) return 'var(--easy)';
  if (score >= 5) return 'var(--medium)';
  return 'var(--hard)';
}

export default function HistoryTable({ sessions }: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const navigate = useNavigate();
  const { t, uiLanguage } = useI18n();

  const completed = sessions.filter((s) => s.status === 'completed');
  if (completed.length === 0) {
    return (
      <div className="empty-state">
        <p>{t('noCompleted')}</p>
        <button className="btn-text" onClick={() => navigate('/')}>
          {t('startFirstInterview')} -&gt;
        </button>
      </div>
    );
  }

  const formatDate = (iso: string | null): string => {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString(uiLanguage === 'zh' ? 'zh-CN' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const dims = (s: SessionData) => [
    { label: t('requirements'), score: s.score_requirements ?? 0 },
    { label: t('components'), score: s.score_components ?? 0 },
    { label: t('scalability'), score: s.score_scalability ?? 0 },
    { label: t('dataModeling'), score: s.score_data_modeling ?? 0 },
    { label: t('communication'), score: s.score_communication ?? 0 },
  ];

  const titleFor = (s: SessionData) => {
    if (s.session_type !== 'jd_tailored') return s.question_title;
    const prefix = [s.profile?.company_name, s.profile?.role_title].filter(Boolean).join(' / ');
    return prefix ? `${prefix}: ${s.custom_question_title || s.question_title}` : s.custom_question_title || s.question_title;
  };

  return (
    <div className="history-table-wrapper">
      <table className="history-table">
        <thead>
          <tr>
            <th>{t('date')}</th>
            <th>{t('question')}</th>
            <th>{t('type')}</th>
            <th>{t('difficulty')}</th>
            <th>{t('duration')}</th>
            <th>{t('score')}</th>
            <th>{t('view')}</th>
          </tr>
        </thead>
        <tbody>
          {completed.map((s) => (
            <Fragment key={s.id}>
              <tr className={expandedId === s.id ? 'expanded' : ''}>
                <td>{formatDate(s.started_at)}</td>
                <td>{titleFor(s)}</td>
                <td>{s.session_type === 'jd_tailored' ? t('jdTailored') : t('builtIn')}</td>
                <td>
                  <span style={{ color: difficultyColor[s.difficulty] || 'var(--text-secondary)' }}>
                    {s.difficulty}
                  </span>
                </td>
                <td>{formatDuration(s.duration_seconds)}</td>
                <td><ScoreDot total={s.score_total} /></td>
                <td>
                  <button
                    className="btn-text small"
                    onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                  >
                    {expandedId === s.id ? t('collapse') : t('view')}
                  </button>
                </td>
              </tr>
              {expandedId === s.id && (
                <tr className="accordion-row">
                  <td colSpan={7}>
                    <div className="accordion-content">
                      <div className="inline-scorecard">
                        <div className="scorecard-dims">
                          {dims(s).map((d) => (
                            <div key={d.label} className="scorecard-dim">
                              <div className="scorecard-dim-header">
                                <span className="scorecard-dim-label">{d.label}</span>
                                <span className="scorecard-dim-score" style={{ color: barColor(d.score) }}>{d.score}/10</span>
                              </div>
                              <div className="scorecard-bar-bg">
                                <div className="scorecard-bar-fill" style={{ width: `${(d.score / 10) * 100}%`, backgroundColor: barColor(d.score) }} />
                              </div>
                            </div>
                          ))}
                        </div>
                        {s.role_fit_summary && (
                          <>
                            <div className="scorecard-divider" />
                            <div className="scorecard-section-header">{t('roleFit')}</div>
                            <p className="scorecard-summary">{s.role_fit_summary}</p>
                          </>
                        )}
                        {s.missed_points && s.missed_points.length > 0 && (
                          <>
                            <div className="scorecard-divider" />
                            <div className="scorecard-section-header">{t('missedPoints')}</div>
                            <ul className="scorecard-bullets">
                              {s.missed_points.map((p, i) => <li key={i}>- {p}</li>)}
                            </ul>
                          </>
                        )}
                        {s.summary && (
                          <>
                            <div className="scorecard-divider" />
                            <div className="scorecard-section-header">{t('summary')}</div>
                            <p className="scorecard-summary">{s.summary}</p>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
