/**
 * Message input with dictation.
 *
 * Kept separate so typing re-renders only this component rather than the whole
 * transcript and recommendation panel on every keystroke.
 */
const ChatComposer = ({
  value,
  onChange,
  onSend,
  isListening,
  onVoiceInput,
  voiceSupported,
  disabled,
}) => {
  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  };

  return (
    <div className="border-t border-white/10 bg-white/5 p-4 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <label htmlFor="chat-input" className="sr-only">
          Message ZENOVA
        </label>
        <input
          id="chat-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="How are you feeling?"
          disabled={disabled}
          className="flex-grow rounded-2xl border border-white/20 bg-white/10 p-3 text-white placeholder-gray-400 backdrop-blur-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 disabled:opacity-60"
        />

        {voiceSupported && (
          <button
            type="button"
            onClick={onVoiceInput}
            disabled={isListening || disabled}
            aria-label={isListening ? "Listening" : "Speak your message"}
            className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${
              isListening
                ? "animate-pulse border-transparent bg-red-500 text-white"
                : "border-white/20 bg-white/10 text-white/80 hover:bg-white/20"
            }`}
          >
            <i
              className={`fa-solid ${isListening ? "fa-stop" : "fa-microphone"} text-sm`}
              aria-hidden="true"
            />
          </button>
        )}

        <button
          type="button"
          onClick={onSend}
          disabled={!value.trim() || disabled}
          aria-label="Send message"
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
        >
          <i className="fa-solid fa-paper-plane text-sm" aria-hidden="true" />
        </button>
      </div>

      {isListening && (
        <p className="mt-2 text-center text-xs text-gray-400" role="status">
          Listening…
        </p>
      )}
    </div>
  );
};

export default ChatComposer;
