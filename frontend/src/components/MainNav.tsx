import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/useI18n';

export default function MainNav() {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <nav className="nav-links main-nav">
      <button className="btn-text" onClick={() => navigate('/')}>{t('practice')}</button>
      <button className="btn-text" onClick={() => navigate('/custom')}>{t('customJdInterview')}</button>
      <button className="btn-text" onClick={() => navigate('/career')}>{t('careerMode')}</button>
      <button className="btn-text" onClick={() => navigate('/history')}>{t('history')}</button>
    </nav>
  );
}
