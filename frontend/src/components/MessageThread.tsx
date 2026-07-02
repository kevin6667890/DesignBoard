import { useLayoutEffect, useRef } from 'react';
import type { MessageData } from '../lib/api';

interface Props {
  messages: MessageData[];
  streamingText: string;
  isStreaming: boolean;
}

export default function MessageThread({ messages, streamingText, isStreaming }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, streamingText]);

  return (
    <div className="message-thread" ref={containerRef}>
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`message ${msg.role === 'interviewer' ? 'message-left' : 'message-right'}`}
        >
          <div className="message-label">
            {msg.role === 'interviewer' ? 'Alex' : 'You'}
            {msg.role === 'candidate' && (
              <span className="message-mode">{msg.input_mode === 'voice' ? 'voice' : 'text'}</span>
            )}
          </div>
          {msg.role === 'interviewer' ? (
            <div className="message-text">{msg.content}</div>
          ) : (
            <div className="message-bubble">{msg.content}</div>
          )}
        </div>
      ))}
      {streamingText && (
        <div className="message message-left">
          <div className="message-label">Alex</div>
          <div className="message-text">
            {streamingText}
            {isStreaming && <span className="streaming-cursor">|</span>}
          </div>
        </div>
      )}
    </div>
  );
}
