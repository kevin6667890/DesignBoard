import { useEffect, useState, useCallback } from 'react';

interface Props {
  startedAt: string;
  onTimeUp: () => void;
  totalSeconds?: number;
}

export default function Timer({ startedAt, onTimeUp, totalSeconds }: Props) {
  const totalSec = totalSeconds ?? 45 * 60; // default 45 min
  const calcTimeLeft = useCallback(() => {
    const start = new Date(startedAt).getTime();
    const now = Date.now();
    const elapsed = Math.floor((now - start) / 1000);
    return Math.max(0, totalSec - elapsed);
  }, [startedAt, totalSec]);

  const [timeLeft, setTimeLeft] = useState(calcTimeLeft());

  useEffect(() => {
    setTimeLeft(calcTimeLeft());
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(interval);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [calcTimeLeft]);

  useEffect(() => {
    if (timeLeft <= 0) {
      onTimeUp();
    }
  }, [timeLeft, onTimeUp]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  let color = 'var(--text-primary)';
  if (timeLeft <= 0) color = 'var(--hard)';
  else if (timeLeft <= 300) color = 'var(--hard)';
  else if (timeLeft <= 600) color = 'var(--medium)';

  return (
    <div className="timer" style={{ color }}>
      <span className="timer-display">{display}</span>
    </div>
  );
}
