import { useI18n } from '../i18n/useI18n';
import type { Language } from '../i18n/translations';

function LanguageToggle({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help: string;
  value: Language;
  onChange: (language: Language) => void;
}) {
  return (
    <div className="language-control">
      <div>
        <div className="language-label">{label}</div>
        <div className="language-help">{help}</div>
      </div>
      <div className="segmented-control">
        <button className={value === 'en' ? 'active' : ''} onClick={() => onChange('en')}>English</button>
        <button className={value === 'zh' ? 'active' : ''} onClick={() => onChange('zh')}>中文</button>
      </div>
    </div>
  );
}

export default function LanguageControls() {
  const { t, uiLanguage, interviewLanguage, setUiLanguage, setInterviewLanguage } = useI18n();

  return (
    <div className="language-controls">
      <LanguageToggle
        label={t('uiLanguage')}
        help={t('uiLanguageHelp')}
        value={uiLanguage}
        onChange={setUiLanguage}
      />
      <LanguageToggle
        label={t('interviewLanguage')}
        help={t('interviewLanguageHelp')}
        value={interviewLanguage}
        onChange={setInterviewLanguage}
      />
    </div>
  );
}
