import { useNavigate } from 'react-router-dom';

interface BackLinkProps {
  to?: string;
  label: string;
}

export default function BackLink({ to, label }: BackLinkProps) {
  const navigate = useNavigate();
  const handleClick = () => {
    if (to) {
      navigate(to);
    } else {
      navigate(-1);
    }
  };

  return (
    <button
      className="back-link"
      onClick={handleClick}
      aria-label={label}
    >
      <span className="back-chevron" aria-hidden="true">←</span>
      {label}
    </button>
  );
}
