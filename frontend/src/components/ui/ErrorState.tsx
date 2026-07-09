interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export default function ErrorState({ message, onRetry, retryLabel = 'Try again' }: ErrorStateProps) {
  return (
    <div className="error-state" role="alert">
      <p className="error-state-msg">{message}</p>
      {onRetry && (
        <button className="btn-text" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  );
}
