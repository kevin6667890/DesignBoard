import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechRecognitionResultListLike = SpeechRecognitionResultList;

interface SpeechRecognitionEventLike extends Event {
  results: SpeechRecognitionResultListLike;
  resultIndex: number;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface FinalTranscript {
  text: string;
  confidence?: number;
}

interface UsePushToTalkOptions {
  onFinalTranscript: (result: FinalTranscript) => void;
  disabled?: boolean;
}

type VoiceInputStatus = 'unsupported' | 'idle' | 'listening' | 'denied' | 'error';

export function usePushToTalk({ onFinalTranscript, disabled = false }: UsePushToTalkOptions) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listeningRef = useRef(false);
  const onFinalRef = useRef(onFinalTranscript);
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<VoiceInputStatus>('idle');

  useEffect(() => {
    onFinalRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  useEffect(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const supported = Boolean(Recognition);
    setIsSupported(supported);
    setStatus(supported ? 'idle' : 'unsupported');
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = '';
      let finalText = '';
      let confidence: number | undefined;

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) {
          finalText += transcript;
          confidence = result[0]?.confidence;
        } else {
          interim += transcript;
        }
      }

      setInterimTranscript(interim.trim());
      const cleanFinal = finalText.trim();
      if (cleanFinal) {
        onFinalRef.current({ text: cleanFinal, confidence });
      }
    };

    recognition.onerror = (event) => {
      const denied = event.error === 'not-allowed' || event.error === 'service-not-allowed';
      setError(event.error || 'speech recognition error');
      setStatus(denied ? 'denied' : 'error');
      setIsListening(false);
      listeningRef.current = false;
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
      listeningRef.current = false;
      setStatus((current) => current === 'listening' ? 'idle' : current);
    };

    recognitionRef.current = recognition;
    return () => {
      recognition.abort();
      recognitionRef.current = null;
    };
  }, []);

  const startListening = useCallback(() => {
    if (disabled || listeningRef.current || !recognitionRef.current) return;
    setError(null);
    setInterimTranscript('');
    try {
      recognitionRef.current.start();
      listeningRef.current = true;
      setIsListening(true);
      setStatus('listening');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start speech recognition');
      setIsListening(false);
      listeningRef.current = false;
      setStatus('error');
    }
  }, [disabled]);

  const stopListening = useCallback(() => {
    if (!listeningRef.current || !recognitionRef.current) return;
    recognitionRef.current.stop();
  }, []);

  return {
    isSupported,
    isListening,
    interimTranscript,
    error,
    status,
    startListening,
    stopListening,
  };
}
