import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MessageList from "./MessageList.jsx";

const MESSAGES = [
  { text: "Hi there", sender: "assistant" },
  { text: "I feel tired", sender: "user" },
  { text: "Something went wrong", sender: "system" },
];

describe("MessageList", () => {
  it("renders every message", () => {
    render(<MessageList messages={MESSAGES} isTyping={false} endRef={{ current: null }} />);

    MESSAGES.forEach((message) => {
      expect(screen.getByText(message.text)).toBeInTheDocument();
    });
  });

  it("exposes the transcript as a live region", () => {
    render(<MessageList messages={MESSAGES} isTyping={false} endRef={{ current: null }} />);

    const list = screen.getByRole("list", { name: /conversation/i });
    expect(list).toHaveAttribute("aria-live", "polite");
  });

  it("announces the typing state to screen readers", () => {
    render(<MessageList messages={MESSAGES} isTyping endRef={{ current: null }} />);

    expect(screen.getByText(/ZENOVA is typing/i)).toBeInTheDocument();
  });

  it("hides the typing indicator when idle", () => {
    render(<MessageList messages={MESSAGES} isTyping={false} endRef={{ current: null }} />);

    expect(screen.queryByText(/is typing/i)).not.toBeInTheDocument();
  });

  it("renders children below the transcript", () => {
    render(
      <MessageList messages={MESSAGES} isTyping={false} endRef={{ current: null }}>
        <p>support banner</p>
      </MessageList>
    );

    expect(screen.getByText("support banner")).toBeInTheDocument();
  });
});
