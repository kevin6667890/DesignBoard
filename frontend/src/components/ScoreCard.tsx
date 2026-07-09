import { useNavigate } from 'react-router-dom';
import type { SessionData } from '../lib/api';
import { useI18n } from '../i18n/useI18n';

interface Props {
  session: SessionData;
  onClose: () => void;
}

interface Dimension {
  label: string;
  score: number;
  key: string;
}

export default function ScoreCard({ session, onClose }: Props) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const dims: Dimension[] = [
    { label: t('requirements'), score: session.score_requirements ?? 0, key: 'req' },
    { label: t('components'), score: session.score_components ?? 0, key: 'comp' },
    { label: t('scalability'), score: session.score_scalability ?? 0, key: 'scal' },
    { label: t('dataModeling'), score: session.score_data_modeling ?? 0, key: 'data' },
    { label: t('communication'), score: session.score_communication ?? 0, key: 'comm' },
  ];

  const total = session.score_total ?? 0;

  const barColor = (score: number) => {
    if (score >= 7) return 'var(--easy)';
    if (score >= 5) return 'var(--medium)';
    return 'var(--hard)';
  };

  return (
    <div className="scorecard-overlay" onClick={onClose}>
      <div className="scorecard-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="scorecard-header">
          <div>
            <div className="scorecard-section-header">{t('overallScore')}</div>
            <h2 className="scorecard-title">{session.custom_question_title || session.question_title}</h2>
          </div>
          <div className="scorecard-total">{total} <span className="scorecard-total-max">/ 50</span></div>
        </div>

        <div className="scorecard-dims">
          {dims.map((d) => (
            <div key={d.key} className="scorecard-dim">
              <div className="scorecard-dim-header">
                <span className="scorecard-dim-label">{d.label}</span>
                <span className="scorecard-dim-score" style={{ color: barColor(d.score) }}>{d.score}/10</span>
              </div>
              <div className="scorecard-bar-bg">
                <div
                  className="scorecard-bar-fill"
                  style={{
                    width: `${(d.score / 10) * 100}%`,
                    backgroundColor: barColor(d.score),
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="scorecard-divider" />

        {session.role_fit_summary && (
          <>
            <div className="scorecard-section-header">{t('roleFit')}</div>
            <p className="scorecard-summary">{session.role_fit_summary}</p>
            <div className="scorecard-divider" />
          </>
        )}

        {session.missed_points && session.missed_points.length > 0 && (
          <>
            <div className="scorecard-section-header">{t('missedPoints')}</div>
            <ul className="scorecard-bullets">
              {session.missed_points.map((point, i) => (
                <li key={i}>- {point}</li>
              ))}
            </ul>
            <div className="scorecard-divider" />
          </>
        )}

        {session.summary && (
          <>
            <div className="scorecard-section-header">{t('verdict')}</div>
            <p className="scorecard-summary">{session.summary}</p>
          </>
        )}

        <div className="scorecard-actions">
          <button className="btn-text" onClick={() => navigate('/history')}>{t('viewHistory')}</button>
          <button className="btn-filled" onClick={() => navigate('/')}>{t('startNewInterview')}</button>
        </div>
      </div>
    </div>
  );
}
