import { memo } from "react";

const BUBBLE_STYLES = {
  user: "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-purple-500/25",
  assistant: "bg-white/10 backdrop-blur-xl border border-white/20 text-white shadow-lg",
  system: "bg-amber-500/15 border border-amber-400/30 text-amber-100",
};

const Message = memo(({ message }) => (
  <li className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
    <div
      className={`max-w-md whitespace-pre-wrap rounded-3xl p-4 ${
        BUBBLE_STYLES[message.sender] ?? BUBBLE_STYLES.assistant
      }`}
    >
      {message.text}
    </div>
  </li>
));

Message.displayName = "Message";

const TypingIndicator = () => (
  <li className="flex justify-start" aria-live="polite">
    <div className="flex gap-1 rounded-3xl border border-white/20 bg-white/10 p-4">
      <span className="sr-only">ZENOVA is typing</span>
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-2 w-2 animate-bounce rounded-full bg-white/60"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  </li>
);

/**
 * The conversation transcript.
 *
 * Marked up as a list with an aria-live region so a screen reader announces
 * replies as they arrive rather than leaving them silently in the DOM.
 */
const MessageList = ({ messages, isTyping, endRef, children }) => (
  <div className="flex-grow overflow-y-auto p-6">
    <ul className="space-y-6" aria-live="polite" aria-label="Conversation">
      {messages.map((message, index) => (
        <Message key={`${index}-${message.text.slice(0, 24)}`} message={message} />
      ))}
      {isTyping && <TypingIndicator />}
    </ul>

    {children}
    <div ref={endRef} />
  </div>
);

export default MessageList;
