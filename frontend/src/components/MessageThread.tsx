import { useEffect, useRef } from 'react';
import type { MessageData } from '../lib/api';

interface Props {
  messages: MessageData[];
  streamingText: string;
  isStreaming: boolean;
}

export default function MessageThread({ messages, streamingText, isStreaming }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  return (
    <div className="message-thread">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`message ${msg.role === 'interviewer' ? 'message-left' : 'message-right'}`}
        >
          <div className="message-label">
            {msg.role === 'interviewer' ? 'Alex' : 'You'}
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
            {isStreaming && <span className="streaming-cursor">▋</span>}
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
