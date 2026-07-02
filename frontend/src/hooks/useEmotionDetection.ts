import { useEffect, useMemo, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';

export type EmotionLabel = 'neutral' | 'confident' | 'nervous' | 'confused' | 'focused';

type EmotionStatus = 'off' | 'starting' | 'ready' | 'camera-unavailable' | 'detection-unavailable';

const MODEL_URL = '/models';

function mode(labels: EmotionLabel[]): EmotionLabel {
  const counts = labels.reduce<Record<EmotionLabel, number>>((acc, label) => {
    acc[label] += 1;
    return acc;
  }, {
    neutral: 0,
    confident: 0,
    nervous: 0,
    confused: 0,
    focused: 0,
  });

  return labels.reduce((best, label) => (counts[label] > counts[best] ? label : best), labels[0] ?? 'neutral');
}

function mapExpressions(expressions: faceapi.FaceExpressions): EmotionLabel {
  const happy = expressions.happy ?? 0;
  const neutral = expressions.neutral ?? 0;
  const surprised = expressions.surprised ?? 0;
  const fearful = expressions.fearful ?? 0;
  const sad = expressions.sad ?? 0;
  const angry = expressions.angry ?? 0;
  const disgusted = expressions.disgusted ?? 0;

  if (happy > 0.55 || (happy > 0.35 && neutral > 0.25)) return 'confident';
  if (fearful > 0.22 || sad > 0.28) return 'nervous';
  if (surprised > 0.35 || angry > 0.25 || disgusted > 0.18) return 'confused';
  if (neutral > 0.72) return 'focused';
  return 'neutral';
}

export function useEmotionDetection(enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recentLabelsRef = useRef<EmotionLabel[]>([]);
  const intervalRef = useRef<number | null>(null);
  const [label, setLabel] = useState<EmotionLabel>('neutral');
  const [stableLabel, setStableLabel] = useState<EmotionLabel>('neutral');
  const [status, setStatus] = useState<EmotionStatus>('off');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!enabled) {
        setStatus('off');
        setError(null);
        return;
      }

      setStatus('starting');
      setError(null);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (err) {
        setStatus('camera-unavailable');
        setError(err instanceof Error ? err.message : 'Camera permission was denied');
        return;
      }

      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);
      } catch (err) {
        setStatus('detection-unavailable');
        setError(err instanceof Error ? err.message : 'Face expression models could not be loaded');
        return;
      }

      if (cancelled) return;
      setStatus('ready');

      intervalRef.current = window.setInterval(async () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) return;

        try {
          const detection = await faceapi
            .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 }))
            .withFaceExpressions();

          if (!detection) return;

          const next = mapExpressions(detection.expressions);
          recentLabelsRef.current = [...recentLabelsRef.current.slice(-7), next];
          setLabel(next);
          setStableLabel(mode(recentLabelsRef.current));
        } catch {
          setStatus('detection-unavailable');
        }
      }, 300);
    }

    start();

    return () => {
      cancelled = true;
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recentLabelsRef.current = [];
    };
  }, [enabled]);

  return useMemo(() => ({
    videoRef,
    label,
    stableLabel,
    status,
    error,
  }), [label, stableLabel, status, error]);
}
