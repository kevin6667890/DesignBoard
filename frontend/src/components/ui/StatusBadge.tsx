type StatusBadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

interface StatusBadgeProps {
  label: string;
  variant?: StatusBadgeVariant;
}

const variantClass: Record<StatusBadgeVariant, string> = {
  neutral: 'badge-neutral',
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  info: 'badge-info',
};

export default function StatusBadge({ label, variant = 'neutral' }: StatusBadgeProps) {
  return (
    <span className={`status-badge ${variantClass[variant]}`}>
      {label}
    </span>
  );
}
