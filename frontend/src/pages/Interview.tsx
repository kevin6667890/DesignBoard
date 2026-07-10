import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { SessionData, MessageData } from '../lib/api';
import { getSession, sendMessageStream, endSession } from '../lib/api';
import MessageThread from '../components/MessageThread';
import Timer from '../components/Timer';
import ScoreCard from '../components/ScoreCard';
import AlexAvatar, { type AlexAvatarState } from '../components/avatar/AlexAvatar';
import VideoMirror from '../components/interview/VideoMirror';
import { usePushToTalk } from '../hooks/usePushToTalk';
import { useTTS } from '../hooks/useTTS';
import type { EmotionLabel } from '../hooks/useEmotionDetection';
import { useI18n } from '../i18n/useI18n';

type InputMode = 'text' | 'voice';

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
  const [notFound, setNotFound] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [stableEmotion, setStableEmotion] = useState<EmotionLabel>('neutral');
  const { t, interviewLanguage } = useI18n();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const endedRef = useRef(false);
  const sessionRef = useRef<SessionData | null>(null);
  const isStreamingRef = useRef(false);
  const stableEmotionRef = useRef<EmotionLabel>('neutral');

  const tts = useTTS({ language: session?.interview_language ?? interviewLanguage });

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  useEffect(() => {
    stableEmotionRef.current = stableEmotion;
  }, [stableEmotion]);

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
      .catch(() => setNotFound(true));
  }, [sessionId]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 6 * 24)}px`;
    }
  }, [input]);

  const submitAnswer = useCallback(async (
    rawText: string,
    inputMode: InputMode,
    transcriptConfidence?: number,
  ) => {
    const currentSession = sessionRef.current;
    const text = rawText.trim();
    if (!text || isStreamingRef.current || !currentSession || currentSession.status !== 'active') return;

    tts.cancel();
    setInput('');
    const temp: MessageData = {
      id: Date.now(),
      session_id: currentSession.id,
      role: 'candidate',
      content: text,
      created_at: new Date().toISOString(),
      input_mode: inputMode,
      transcript_confidence: transcriptConfidence ?? null,
    };
    setMessages((prev) => [...prev, temp]);
    setIsStreaming(true);
    setStreamingText('');

    let accumulated = '';

    try {
      await sendMessageStream(
        currentSession.id,
        text,
        {
          emotion_label: stableEmotionRef.current,
          input_mode: inputMode,
          transcript_confidence: transcriptConfidence,
        },
        (delta) => {
          accumulated += delta;
          setStreamingText(accumulated);
        },
        () => {
          setIsStreaming(false);
          setStreamingText('');
          if (accumulated.trim()) {
            tts.speak(accumulated);
          }
          const latestSession = sessionRef.current;
          if (latestSession) {
            getSession(latestSession.id)
              .then((data) => setMessages((prev) => data.messages.length >= prev.length ? data.messages : prev))
              .catch(console.error);
          }
        },
        (err) => {
          console.error(err);
          setIsStreaming(false);
          setStreamingText('');
        },
      );
    } catch (err) {
      console.error(err);
      setIsStreaming(false);
      setStreamingText('');
    }
  }, [tts]);

  const pushToTalk = usePushToTalk({
    disabled: isStreaming || !session || session.status !== 'active',
    onFinalTranscript: ({ text, confidence }) => {
      void submitAnswer(text, 'voice', confidence);
    },
  });

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || isTypingTarget(event.target)) return;
      event.preventDefault();
      pushToTalk.startListening();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isTypingTarget(event.target)) return;
      event.preventDefault();
      pushToTalk.stopListening();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [pushToTalk]);

  const handleSend = () => {
    void submitAnswer(input, 'text');
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
    tts.cancel();

    try {
      const completed = await endSession(session.id);
      setSession(completed);
      setShowScore(true);
    } catch (err) {
      console.error(err);
      endedRef.current = false;
    } finally {
      setEnding(false);
    }
  };

  const handleTimeUp = useCallback(() => {
    if (!timeUp && session && session.status === 'active' && !endedRef.current) {
      setTimeUp(true);
      void handleEnd();
    }
  }, [timeUp, session]);

  if (notFound) {
    return (
      <div className="interview-loading">
        <p style={{ marginBottom: 12 }}>{t('sessionNotFound')}</p>
        <button className="btn-text" onClick={() => navigate('/')}>{t('backToHome')}</button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="interview-loading">
        <p>{t('loading')}</p>
      </div>
    );
  }

  const difficultyColor: Record<string, string> = {
    Easy: 'var(--easy)',
    Medium: 'var(--medium)',
    Hard: 'var(--hard)',
  };

  const avatarState: AlexAvatarState = tts.isSpeaking
    ? 'speaking'
    : isStreaming
      ? 'thinking'
      : pushToTalk.isListening
        ? 'listening'
      : 'idle';

  const voiceStatusMessage = (() => {
    if (!pushToTalk.isSupported || pushToTalk.status === 'unsupported') {
      return t('voiceUnsupported');
    }
    if (isStreaming) return t('processingAnswer');
    if (pushToTalk.isListening) return t('listeningRelease');
    if (pushToTalk.status === 'denied') {
      return t('micDenied');
    }
    if (pushToTalk.status === 'error') return t('voiceFailed');
    return t('holdToSpeak');
  })();

  return (
    <div className="interview-room">
      <header className="room-topbar">
        <div className="room-brand">
          <span className="wordmark">{t('designBoard')}</span>
          <span
            className="difficulty-tag"
            style={{ color: difficultyColor[session.difficulty] || 'var(--text-secondary)' }}
          >
            {session.difficulty}
          </span>
        </div>

        <div className="room-question">
          <span className="room-question-label">{t('interview')}</span>
          <h1>{session.question_title}</h1>
        </div>

        <div className="room-actions">
          {session.status === 'active' && (
            <Timer startedAt={session.started_at!} onTimeUp={handleTimeUp} />
          )}
          {session.status === 'active' && (
            <button className="end-btn compact" onClick={() => setShowConfirm(true)} disabled={ending}>
              {ending ? t('scoring') : t('endInterview')}
            </button>
          )}
          <button className="btn-text" onClick={() => navigate('/')}>{t('home')}</button>
        </div>
      </header>

      {timeUp && <div className="time-up-banner room-banner">{t('timeUp')}</div>}

      {showConfirm && (
        <div className="confirm-dialog room-confirm">
          <p>{t('endConfirm')}</p>
          <div className="confirm-actions">
            <button className="btn-text" onClick={() => setShowConfirm(false)}>{t('cancel')}</button>
            <button className="btn-filled" onClick={handleEnd}>{t('confirm')}</button>
          </div>
        </div>
      )}

      <main className="room-main">
        <section className="alex-panel" aria-label="Alex interviewer">
          <div className="panel-header">
            <span>{t('alex')}</span>
            <span>{avatarState}</span>
          </div>
          <div className="avatar-stage">
            <AlexAvatar state={avatarState} />
          </div>
          <div className="voice-controls">
            <button className="btn-text small" onClick={tts.toggleMuted} disabled={!tts.isSupported}>
              {tts.muted ? t('unmute') : t('mute')}
            </button>
            {tts.isSpeaking && (
              <button className="btn-text small" onClick={tts.cancel}>{t('skipVoice')}</button>
            )}
            {!tts.isSupported && <span className="fallback-note">speech synthesis unavailable</span>}
          </div>
        </section>

        <VideoMirror
          enabled={cameraEnabled}
          onToggle={() => setCameraEnabled((current) => !current)}
          onStableEmotionChange={setStableEmotion}
        />
      </main>

      <section className="room-bottom">
        <div className="transcript-panel">
          <div className="panel-header">
            <span>{t('recentTranscript')}</span>
            <span>{t('candidateState')}: {stableEmotion}</span>
          </div>
          <MessageThread messages={messages} streamingText={streamingText} isStreaming={isStreaming} />
        </div>

        {session.status === 'active' && (
          <div className="input-area multimodal-input">
            <div className="ptt-row">
              <button
                className={`push-talk-btn ${pushToTalk.isListening ? 'listening' : ''}`}
                onPointerDown={pushToTalk.startListening}
                onPointerUp={pushToTalk.stopListening}
                onPointerLeave={pushToTalk.stopListening}
                disabled={!pushToTalk.isSupported || isStreaming}
              >
                {pushToTalk.isListening ? t('listeningRelease') : t('holdToTalk')}
              </button>
              <span className="voice-status">{voiceStatusMessage}</span>
            </div>

            {pushToTalk.interimTranscript && (
              <div className="interim-transcript">{pushToTalk.interimTranscript}</div>
            )}
            {pushToTalk.error && pushToTalk.status === 'error' && (
              <div className="fallback-note">{t('voiceFailed')}</div>
            )}

            <div className="input-row">
              <textarea
                ref={textareaRef}
                className="message-input"
                placeholder={t('fallbackPlaceholder')}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isStreaming}
                rows={1}
              />
              <button className="send-btn" onClick={handleSend} disabled={isStreaming || !input.trim()}>
                {t('sendAnswer')}
              </button>
            </div>
            {isStreaming && <div className="streaming-label">{t('alexResponding')}</div>}
          </div>
        )}
      </section>

      {showScore && session && session.score_total !== null && (
        <ScoreCard session={session} onClose={() => setShowScore(false)} />
      )}
    </div>
  );
}
