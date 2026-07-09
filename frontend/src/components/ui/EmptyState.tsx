interface EmptyStateProps {
  message: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div className="empty-state" role="status">
      <p className="empty-state-msg">{message}</p>
      {action && (
        <button className="btn-filled" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
