import { useNavigate } from 'react-router-dom';
import type { Question } from '../lib/api';
import { createSession } from '../lib/api';
import { useI18n } from '../i18n/useI18n';

interface Props {
  questions: Question[];
}

const difficultyColor: Record<string, string> = {
  Easy: 'var(--easy)',
  Medium: 'var(--medium)',
  Hard: 'var(--hard)',
};

export default function QuestionGrid({ questions }: Props) {
  const navigate = useNavigate();
  const { t, uiLanguage, interviewLanguage } = useI18n();

  const handleStart = async (q: Question) => {
    try {
      const res = await createSession(q.id, interviewLanguage);
      navigate(`/interview/${res.session.id}`);
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const difficultyLabel = (difficulty: Question['difficulty']) => {
    if (difficulty === 'Easy') return t('easy');
    if (difficulty === 'Medium') return t('medium');
    return t('hard');
  };

  return (
    <div className="question-grid">
      {questions.map((q) => {
        const title = uiLanguage === 'zh' ? q.title_zh || q.title : q.title;
        const description = uiLanguage === 'zh' ? q.description_zh || q.description : q.description;
        return (
          <div
            key={q.id}
            className="question-card"
            onClick={() => handleStart(q)}
          >
            <div className="question-card-header">
              <span className="question-title">{title}</span>
              <span
                className="difficulty-tag"
                style={{ color: difficultyColor[q.difficulty] }}
              >
                {difficultyLabel(q.difficulty)}
              </span>
            </div>
            <p className="question-desc">{description}</p>
            <span className="start-hint">{t('startInterview')} -&gt;</span>
          </div>
        );
      })}
    </div>
  );
}
