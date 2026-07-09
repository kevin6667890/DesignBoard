import { useNavigate, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/useI18n';

export default function MainNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="nav-links main-nav" aria-label="Main navigation">
      <button
        className={`btn-text nav-item ${isActive('/') ? 'nav-active' : ''}`}
        onClick={() => navigate('/')}
        aria-current={isActive('/') ? 'page' : undefined}
      >
        {t('practice')}
      </button>
      <button
        className={`btn-text nav-item ${isActive('/custom') ? 'nav-active' : ''}`}
        onClick={() => navigate('/custom')}
        aria-current={isActive('/custom') ? 'page' : undefined}
      >
        {t('customJdInterview')}
      </button>
      <button
        className={`btn-text nav-item ${isActive('/career') ? 'nav-active' : ''}`}
        onClick={() => navigate('/career')}
        aria-current={isActive('/career') ? 'page' : undefined}
      >
        {t('careerMode')}
      </button>
      <button
        className={`btn-text nav-item ${isActive('/history') ? 'nav-active' : ''}`}
        onClick={() => navigate('/history')}
        aria-current={isActive('/history') ? 'page' : undefined}
      >
        {t('history')}
      </button>
    </nav>
  );
}
