import { useCallback, useEffect, useRef, useState } from 'react';

interface UseTTSOptions {
  onStart?: () => void;
  onEnd?: () => void;
  language?: 'en' | 'zh';
}

export function useTTS({ onStart, onEnd, language = 'en' }: UseTTSOptions = {}) {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setIsSupported('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window);
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  const cancel = useCallback(() => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setIsSpeaking(false);
    onEnd?.();
  }, [onEnd]);

  const speak = useCallback((text: string) => {
    if (muted || !text.trim() || !('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.96;
    utterance.pitch = 0.92;
    utterance.volume = 1;
    utterance.lang = language === 'zh' ? 'zh-CN' : 'en-US';

    const voices = window.speechSynthesis.getVoices();
    const preferred = language === 'zh'
      ? voices.find((voice) => /zh|cmn|yue/i.test(voice.lang))
      : voices.find((voice) => voice.lang.startsWith('en') && /male|daniel|david|mark/i.test(voice.name));
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => {
      setIsSpeaking(true);
      onStart?.();
    };
    utterance.onend = () => {
      utteranceRef.current = null;
      setIsSpeaking(false);
      onEnd?.();
    };
    utterance.onerror = () => {
      utteranceRef.current = null;
      setIsSpeaking(false);
      onEnd?.();
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [language, muted, onEnd, onStart]);

  const toggleMuted = useCallback(() => {
    setMuted((current) => {
      if (!current) cancel();
      return !current;
    });
  }, [cancel]);

  return {
    isSupported,
    isSpeaking,
    muted,
    speak,
    cancel,
    toggleMuted,
  };
}
