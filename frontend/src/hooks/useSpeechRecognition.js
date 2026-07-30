import { useCallback, useEffect, useRef, useState } from "react";

const SpeechRecognitionApi =
  typeof window !== "undefined"
    ? window.SpeechRecognition ?? window.webkitSpeechRecognition
    : null;

export const isSpeechRecognitionSupported = Boolean(SpeechRecognitionApi);

/**
 * Wraps the Web Speech API. Both the chatbot and the playlist page needed
 * dictation and each had built its own copy of this lifecycle.
 *
 * onResult is held in a ref so a caller passing an inline arrow function does
 * not force the recognizer to be rebuilt on every render.
 */
const useSpeechRecognition = ({ onResult, lang = "en-US" } = {}) => {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState(
    isSpeechRecognitionSupported
      ? null
      : "Speech recognition is not supported in this browser. Try Chrome or Edge."
  );

  const recognitionRef = useRef(null);
  const onResultRef = useRef(onResult);

  onResultRef.current = onResult;

  useEffect(() => {
    if (!isSpeechRecognitionSupported) return undefined;

    const recognition = new SpeechRecognitionApi();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = lang;

    recognition.onstart = () => {
      setListening(true);
      setError(null);
    };

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      onResultRef.current?.(text);
    };

    recognition.onerror = (event) => {
      setError(`Could not recognise speech: ${event.error}`);
      setListening(false);
    };

    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;

    setTranscript("");
    setError(null);

    try {
      recognitionRef.current.start();
    } catch {
      // start() throws if the recognizer is already running; that is harmless.
    }
  }, []);

  const stop = useCallback(() => recognitionRef.current?.stop(), []);

  return {
    listening,
    transcript,
    error,
    supported: isSpeechRecognitionSupported,
    start,
    stop,
  };
};

export default useSpeechRecognition;
