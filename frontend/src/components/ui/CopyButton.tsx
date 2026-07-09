import { useState } from 'react';

interface CopyButtonProps {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}

export default function CopyButton({
  text,
  label = 'Copy',
  copiedLabel = 'Copied!',
  className = 'btn-text small',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // fallback: do nothing silently
    }
  };

  return (
    <button
      className={`${className} copy-btn ${copied ? 'copied' : ''}`}
      onClick={handleCopy}
      aria-label={copied ? copiedLabel : label}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
