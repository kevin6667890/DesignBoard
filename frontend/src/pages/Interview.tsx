import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { SessionData, MessageData } from '../lib/api';
import { getSession, sendMessageStream, endSession } from '../lib/api';
import MessageThread from '../components/MessageThread';
import Timer from '../components/Timer';
import ScoreCard from '../components/ScoreCard';

export default function Interview() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<SessionData | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [input, setInput] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showScore, setShowScore] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const [ending, setEnding] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const endedRef = useRef(false);

  // Hydrate on mount
  useEffect(() => {
    if (!sessionId) return;
    const id = parseInt(sessionId, 10);
    getSession(id)
      .then((data) => {
        setSession(data.session);
        setMessages(data.messages);
        if (data.session.status === 'completed') {
          setShowScore(true);
        }
      })
      .catch(console.error);
  }, [sessionId]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 6 * 24) + 'px';
    }
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming || !session || session.status !== 'active') return;

    const text = input.trim();
    setInput('');
    const temp: MessageData = {
      id: Date.now(),
      session_id: session.id,
      role: 'candidate',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, temp]);
    setIsStreaming(true);
    setStreamingText('');

    let accumulated = '';

    try {
      await sendMessageStream(
        session.id,
        text,
        (delta) => {
          accumulated += delta;
          setStreamingText(accumulated);
        },
        () => {
          setIsStreaming(false);
          setStreamingText('');
          // Refresh to get the saved interviewer message
          if (session) {
            getSession(session.id).then((data) => {
              setMessages(data.messages);
            }).catch(console.error);
          }
        },
        (err) => {
          console.error(err);
          setIsStreaming(false);
          setStreamingText('');
        }
      );
    } catch (err) {
      console.error(err);
      setIsStreaming(false);
      setStreamingText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEnd = async () => {
    if (!session || endedRef.current) return;
    setShowConfirm(false);
    setEnding(true);
    endedRef.current = true;

    try {
      const completed = await endSession(session.id);
      setSession(completed);
      setShowScore(true);
    } catch (err) {
      console.error(err);
      endedRef.current = false; // allow retry if API call failed
    } finally {
      setEnding(false);
    }
  };

  const handleTimeUp = useCallback(() => {
    if (!timeUp && session && session.status === 'active' && !endedRef.current) {
      setTimeUp(true);
      handleEnd();
    }
  }, [timeUp, session]);

  if (!session) {
    return (
      <div className="interview-loading">
        <p>Loading interview...</p>
      </div>
    );
  }

  const difficultyColor: Record<string, string> = {
    Easy: 'var(--easy)',
    Medium: 'var(--medium)',
    Hard: 'var(--hard)',
  };

  return (
    <div className="interview">
      {/* Left panel */}
      <aside className="interview-left">
        <div className="left-panel-content">
          <div className="question-info">
            <h2 className="left-question-title">{session.question_title}</h2>
            <span
              className="difficulty-tag"
              style={{ color: difficultyColor[session.difficulty] || 'var(--text-secondary)' }}
            >
              {session.difficulty}
            </span>
          </div>

          <div className="thin-divider" />

          {session.status === 'active' && (
            <Timer
              startedAt={session.started_at!}
              onTimeUp={handleTimeUp}
            />
          )}

          {timeUp && (
            <div className="time-up-banner">
              Time's up — your interview has ended
            </div>
          )}

          {session.status === 'active' && (
            <>
              <button
                className="end-btn"
                onClick={() => setShowConfirm(true)}
                disabled={ending}
              >
                {ending ? 'Generating Scorecard...' : 'End Interview'}
              </button>

              {showConfirm && (
                <div className="confirm-dialog">
                  <p>Are you sure? This will generate your scorecard.</p>
                  <div className="confirm-actions">
                    <button className="btn-text" onClick={() => setShowConfirm(false)}>Cancel</button>
                    <button className="btn-filled" onClick={handleEnd}>Confirm</button>
                  </div>
                </div>
              )}
            </>
          )}

          <button
            className="btn-text back-btn"
            onClick={() => navigate('/')}
          >
            ← Back to Home
          </button>
        </div>
      </aside>

      {/* Right panel */}
      <main className="interview-right">
        <MessageThread
          messages={messages}
          streamingText={streamingText}
          isStreaming={isStreaming}
        />

        {session.status === 'active' && (
          <div className="input-area">
            <div className="input-row">
              <textarea
                ref={textareaRef}
                className="message-input"
                placeholder="Respond to Alex..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isStreaming}
                rows={1}
              />
              <button
                className="send-btn"
                onClick={handleSend}
                disabled={isStreaming || !input.trim()}
              >
                ↵ Send
              </button>
            </div>
            {isStreaming && (
              <div className="streaming-label">Alex is responding...</div>
            )}
          </div>
        )}
      </main>

      {showScore && session && session.score_total !== null && (
        <ScoreCard
          session={session}
          onClose={() => setShowScore(false)}
        />
      )}
    </div>
  );
}
