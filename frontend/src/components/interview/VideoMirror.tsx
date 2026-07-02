import { useEffect } from 'react';
import { useEmotionDetection, type EmotionLabel } from '../../hooks/useEmotionDetection';

interface VideoMirrorProps {
  enabled: boolean;
  onToggle: () => void;
  onStableEmotionChange: (emotion: EmotionLabel) => void;
}

export default function VideoMirror({ enabled, onToggle, onStableEmotionChange }: VideoMirrorProps) {
  const { videoRef, label, stableLabel, status } = useEmotionDetection(enabled);

  useEffect(() => {
    onStableEmotionChange(stableLabel);
  }, [onStableEmotionChange, stableLabel]);

  const unavailable = status === 'camera-unavailable' || status === 'detection-unavailable';
  const statusText = !enabled
    ? 'camera off'
    : status === 'starting'
      ? 'starting camera'
      : status === 'camera-unavailable'
        ? 'camera unavailable'
        : status === 'detection-unavailable'
          ? 'emotion detection unavailable'
          : label;

  return (
    <section className="video-panel" aria-label="Candidate camera">
      <div className="panel-header">
        <span>You</span>
        <button className="btn-text small" onClick={onToggle}>
          {enabled ? 'Disable camera' : 'Enable camera'}
        </button>
      </div>
      <div className="video-frame">
        {enabled && !unavailable ? (
          <video ref={videoRef} className="video-mirror" muted playsInline />
        ) : (
          <div className="video-placeholder">{enabled ? statusText : 'camera disabled'}</div>
        )}
        <div className="emotion-label">
          <span className="emotion-dot" />
          {statusText}
        </div>
      </div>
    </section>
  );
}
