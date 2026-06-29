import { useNavigate } from 'react-router-dom';
import type { Question } from '../lib/api';
import { createSession } from '../lib/api';

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

  const handleStart = async (q: Question) => {
    try {
      const res = await createSession(q.id);
      navigate(`/interview/${res.session.id}`);
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  return (
    <div className="question-grid">
      {questions.map((q) => (
        <div
          key={q.id}
          className="question-card"
          onClick={() => handleStart(q)}
        >
          <div className="question-card-header">
            <span className="question-title">{q.title}</span>
            <span
              className="difficulty-tag"
              style={{ color: difficultyColor[q.difficulty] }}
            >
              {q.difficulty}
            </span>
          </div>
          <p className="question-desc">{q.description}</p>
          <span className="start-hint">Start Interview →</span>
        </div>
      ))}
    </div>
  );
}
