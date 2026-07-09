import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import LanguageControls from '../components/LanguageControls';
import MainNav from '../components/MainNav';
import BackLink from '../components/ui/BackLink';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorState from '../components/ui/ErrorState';
import { analyzeJD, createCustomSession, type BlueprintQuestion, type InterviewBlueprint, type JDProfile } from '../lib/api';
import { useI18n } from '../i18n/useI18n';

function Tags({ items }: { items: string[] }) {
  if (!items.length) return <span className="muted">-</span>;
  return (
    <div className="tag-list">
      {items.map((item) => <span className="tag" key={item}>{item}</span>)}
    </div>
  );
}

function FocusList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="blueprint-section">
      <h3>{title}</h3>
      {items.length ? (
        <ul>
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        <p className="muted">-</p>
      )}
    </section>
  );
}

export default function CustomPlanner() {
  const { t, interviewLanguage, setInterviewLanguage } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const prepared = location.state as { profile?: JDProfile; blueprint?: InterviewBlueprint } | null;
  const [companyName, setCompanyName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [profile, setProfile] = useState<JDProfile | null>(prepared?.profile || null);
  const [blueprint, setBlueprint] = useState<InterviewBlueprint | null>(prepared?.blueprint || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ackShort, setAckShort] = useState(false);
  const [startingQuestion, setStartingQuestion] = useState<string | null>(null);

  const isShort = jobDescription.trim().length > 0 && jobDescription.trim().length < 120;

  const handleGenerate = async () => {
    const jd = jobDescription.trim();
    if (!jd) {
      setError(t('pasteJobDescription'));
      return;
    }
    if (isShort && !ackShort) {
      setAckShort(true);
      setError(t('jdTooShort'));
      return;
    }
    setError('');
    setLoading(true);
    setProfile(null);
    setBlueprint(null);
    try {
      const res = await analyzeJD({
        company_name: companyName.trim() || null,
        role_title: roleTitle.trim() || null,
        job_description: jd,
        interview_language: interviewLanguage,
      });
      setProfile(res.profile);
      setBlueprint(res.blueprint);
    } catch (err) {
      console.error(err);
      setError(t('failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  const startInterview = async (question: BlueprintQuestion) => {
    if (!profile || !blueprint) return;
    setStartingQuestion(question.title);
    try {
      const res = await createCustomSession({
        profile_id: profile.id,
        blueprint_id: blueprint.id,
        custom_question_title: question.title,
        custom_question_context: question,
        difficulty: question.difficulty,
        interview_language: interviewLanguage,
      });
      navigate(`/interview/${res.session.id}`);
    } catch (err) {
      console.error(err);
      setStartingQuestion(null);
    }
  };

  return (
    <div className="planner-page">
      <header className="history-header">
        <div className="logo-area">
          <h1 className="wordmark">{t('designBoard')}</h1>
          <p className="tagline">{t('customInterviewFull')}</p>
        </div>
        <MainNav />
      </header>

      <div className="page-back-row">
        <BackLink to="/" label={t('backToPractice')} />
      </div>

      <LanguageControls />

      <section className="planner-form">
        <div className="form-grid">
          <label className="field-label" htmlFor="company-input">
            {t('company')}
            <input
              id="company-input"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={t('companyNameOptional')}
            />
          </label>
          <label className="field-label" htmlFor="role-input">
            {t('role')}
            <input
              id="role-input"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder={t('roleTitleOptional')}
            />
          </label>
        </div>
        <label className="field-label">{t('interviewLanguage')}</label>
        <div className="segmented-control inline">
          <button
            className={interviewLanguage === 'en' ? 'active' : ''}
            onClick={() => setInterviewLanguage('en')}
            aria-pressed={interviewLanguage === 'en'}
          >
            English
          </button>
          <button
            className={interviewLanguage === 'zh' ? 'active' : ''}
            onClick={() => setInterviewLanguage('zh')}
            aria-pressed={interviewLanguage === 'zh'}
          >
            中文
          </button>
        </div>
        <label className="field-label" htmlFor="jd-textarea">
          {t('jobDescription')} <span className="required-mark">*</span>
        </label>
        <textarea
          id="jd-textarea"
          className="jd-textarea"
          value={jobDescription}
          onChange={(e) => {
            setJobDescription(e.target.value);
            setAckShort(false);
          }}
          placeholder={t('pasteJobDescription')}
          aria-required="true"
        />
        {error && <div className="form-error" role="alert">{error}</div>}
        <button
          className="btn-filled"
          onClick={handleGenerate}
          disabled={loading || !jobDescription.trim()}
          aria-disabled={loading || !jobDescription.trim()}
        >
          {loading ? t('generatingBlueprint') : ackShort ? t('continue') : t('generateInterviewPlan')}
        </button>
        {loading && <LoadingSpinner message={t('generatingBlueprint')} />}
      </section>

      {error && !loading && !profile && (
        <ErrorState message={error} />
      )}

      {profile && blueprint && (
        <div className="blueprint-layout">
          <section className="profile-panel">
            <h2>{t('roleProfile')}</h2>
            <div className="profile-grid">
              <span>{t('company')}</span><strong>{profile.company_name || '-'}</strong>
              <span>{t('role')}</span><strong>{profile.role_title || '-'}</strong>
              <span>{t('seniority')}</span><strong>{profile.seniority}</strong>
              <span>{t('domain')}</span><strong>{profile.domain}</strong>
            </div>
            <h3>{t('techStack')}</h3>
            <Tags items={profile.tech_stack} />
          </section>

          <section className="blueprint-panel">
            <h2>{t('interviewBlueprint')}</h2>
            <p className="blueprint-summary">{blueprint.summary}</p>
            <div className="blueprint-grid">
              <FocusList title={t('codingFocus')} items={blueprint.coding_focus} />
              <FocusList title={t('csFundamentals')} items={blueprint.cs_fundamentals_focus} />
              <FocusList title={t('systemDesign')} items={blueprint.system_design_focus} />
              <FocusList title={t('domainDeepDive')} items={blueprint.domain_deep_dive_focus} />
              <FocusList title={t('behavioral')} items={blueprint.behavioral_focus} />
              <FocusList title={t('scoringFocus')} items={blueprint.scoring_focus} />
            </div>
          </section>

          <section className="question-recommendations">
            <h2>{t('recommendedQuestions')}</h2>
            <div className="custom-question-list">
              {blueprint.custom_system_design_questions.map((q) => (
                <article className="custom-question-card" key={q.title}>
                  <div className="question-card-header">
                    <h3>{q.title}</h3>
                    <span className="difficulty-tag">{q.difficulty}</span>
                  </div>
                  <p><strong>{t('whyRelevant')}:</strong> {q.why_relevant}</p>
                  <div>
                    <strong>{t('expectedTopics')}:</strong>
                    <Tags items={q.expected_topics} />
                  </div>
                  <button
                    className="btn-filled"
                    onClick={() => startInterview(q)}
                    disabled={startingQuestion !== null}
                    aria-disabled={startingQuestion !== null}
                  >
                    {startingQuestion === q.title ? t('loading') : t('startInterview')}
                  </button>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
