interface LoadingSpinnerProps {
  message?: string;
  inline?: boolean;
}

export default function LoadingSpinner({ message, inline = false }: LoadingSpinnerProps) {
  if (inline) {
    return (
      <span className="loading-inline" aria-live="polite">
        <span className="spinner-dot" aria-hidden="true" />
        {message && <span>{message}</span>}
      </span>
    );
  }
  return (
    <div className="loading-block" role="status" aria-live="polite">
      <span className="spinner-ring" aria-hidden="true" />
      {message && <p className="loading-msg">{message}</p>}
    </div>
  );
}
