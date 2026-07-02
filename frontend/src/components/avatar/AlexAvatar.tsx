import { useEffect, useRef } from 'react';

export type AlexAvatarState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface AlexAvatarProps {
  state: AlexAvatarState;
}

export default function AlexAvatar({ state }: AlexAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    let animationId = 0;

    const render = () => {
      frame += 1;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.floor(rect.width * dpr));
      const height = Math.max(1, Math.floor(rect.height * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);

      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const size = Math.min(rect.width, rect.height);
      const breath = Math.sin(frame / 70) * 3;
      const activeState = stateRef.current;
      const radius = size * 0.26 + breath;

      ctx.fillStyle = '#101010';
      ctx.fillRect(0, 0, rect.width, rect.height);

      if (activeState === 'listening') {
        const pulse = (Math.sin(frame / 16) + 1) / 2;
        ctx.strokeStyle = `rgba(148, 163, 184, ${0.22 + pulse * 0.22})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 24 + pulse * 9, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.strokeStyle = '#3a3a3a';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 18, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#181818';
      ctx.strokeStyle = '#525252';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const eyeY = cy - radius * 0.17 + (activeState === 'thinking' ? -7 : 0);
      const eyeOffset = radius * 0.34;
      const blink = frame % 210 > 198 ? 0.14 : 1;
      const eyeShift = activeState === 'thinking' ? 4 : 0;

      ctx.fillStyle = '#d6d6d6';
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(
          cx + dir * eyeOffset + eyeShift,
          eyeY,
          radius * 0.065,
          radius * 0.12 * blink,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }

      ctx.strokeStyle = '#a3a3a3';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      const mouthY = cy + radius * 0.28;

      if (activeState === 'speaking') {
        const amplitude = 0.35 + Math.abs(Math.sin(frame / 5)) * 0.65;
        ctx.beginPath();
        ctx.ellipse(cx, mouthY, radius * 0.19, radius * 0.035 + amplitude * 9, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(cx - radius * 0.18, mouthY);
        ctx.lineTo(cx + radius * 0.18, mouthY);
        ctx.stroke();
      }

      if (activeState === 'thinking') {
        ctx.fillStyle = '#9ca3af';
        for (let i = 0; i < 3; i += 1) {
          const phase = (Math.sin(frame / 12 + i * 1.2) + 1) / 2;
          ctx.globalAlpha = 0.35 + phase * 0.65;
          ctx.beginPath();
          ctx.arc(cx - 18 + i * 18, cy + radius + 42, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = '#737373';
      ctx.font = '12px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`ALEX / ${activeState.toUpperCase()}`, cx, rect.height - 24);

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, []);

  return <canvas ref={canvasRef} className="alex-avatar-canvas" aria-label={`Alex avatar ${state}`} />;
}
