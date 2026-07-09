import { useEffect } from 'react';
import { useEmotionDetection, type EmotionLabel } from '../../hooks/useEmotionDetection';
import { useI18n } from '../../i18n/useI18n';

interface VideoMirrorProps {
  enabled: boolean;
  onToggle: () => void;
  onStableEmotionChange: (emotion: EmotionLabel) => void;
}

export default function VideoMirror({ enabled, onToggle, onStableEmotionChange }: VideoMirrorProps) {
  const { videoRef, label, stableLabel, status } = useEmotionDetection(enabled);
  const { t } = useI18n();

  useEffect(() => {
    onStableEmotionChange(stableLabel);
  }, [onStableEmotionChange, stableLabel]);

  const unavailable = status === 'camera-unavailable' || status === 'detection-unavailable';
  const statusText = !enabled
    ? t('cameraOff')
    : status === 'starting'
      ? t('startingCamera')
      : status === 'camera-unavailable'
        ? t('cameraUnavailable')
        : status === 'detection-unavailable'
          ? t('emotionUnavailable')
          : label;

  return (
    <section className="video-panel" aria-label="Candidate camera">
      <div className="panel-header">
        <span>{t('you')}</span>
        <button className="btn-text small" onClick={onToggle}>
          {enabled ? t('disableCamera') : t('enableCamera')}
        </button>
      </div>
      <div className="video-frame">
        {enabled && !unavailable ? (
          <video ref={videoRef} className="video-mirror" muted playsInline />
        ) : (
          <div className="video-placeholder">{enabled ? statusText : t('cameraDisabled')}</div>
        )}
        <div className="emotion-label">
          <span className="emotion-dot" />
          {statusText}
        </div>
      </div>
    </section>
  );
}
