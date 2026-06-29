import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SessionData } from '../lib/api';

interface Props {
  sessions: SessionData[];
}

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
    year: 'numeric',
  });
}

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

  if (sessions.length === 0) {
    return (
      <div className="empty-state">
        <p>No completed sessions yet.</p>
        <button className="btn-text" onClick={() => navigate('/')}>
          Start your first interview →
        </button>
      </div>
    );
  }

  const completed = sessions.filter((s) => s.status === 'completed');

  return (
    <div className="history-table-wrapper">
      <table className="history-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Question</th>
            <th>Difficulty</th>
            <th>Duration</th>
            <th>Score</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {completed.map((s) => (
            <>
              <tr key={s.id} className={expandedId === s.id ? 'expanded' : ''}>
                <td>{formatDate(s.started_at)}</td>
                <td>{s.question_title}</td>
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
                    {expandedId === s.id ? 'Collapse' : 'View'}
                  </button>
                </td>
              </tr>
              {expandedId === s.id && (
                <tr key={`${s.id}-expanded`} className="accordion-row">
                  <td colSpan={6}>
                    <div className="accordion-content">
                      <div className="inline-scorecard">
                        <div className="scorecard-dims">
                          {[
                            { label: 'Requirements Clarification', score: s.score_requirements ?? 0 },
                            { label: 'System Components', score: s.score_components ?? 0 },
                            { label: 'Scalability', score: s.score_scalability ?? 0 },
                            { label: 'Data Modeling', score: s.score_data_modeling ?? 0 },
                            { label: 'Communication', score: s.score_communication ?? 0 },
                          ].map((d) => (
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
                        {s.missed_points && s.missed_points.length > 0 && (
                          <>
                            <div className="scorecard-divider" />
                            <div className="scorecard-section-header">Missed Points</div>
                            <ul className="scorecard-bullets">
                              {s.missed_points.map((p, i) => <li key={i}>— {p}</li>)}
                            </ul>
                          </>
                        )}
                        {s.summary && (
                          <>
                            <div className="scorecard-divider" />
                            <div className="scorecard-section-header">Summary</div>
                            <p className="scorecard-summary">{s.summary}</p>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
