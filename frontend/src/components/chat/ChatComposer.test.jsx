import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ChatComposer from "./ChatComposer.jsx";

const setup = (props = {}) => {
  const onSend = vi.fn();
  const onChange = vi.fn();

  render(
    <ChatComposer
      value=""
      onChange={onChange}
      onSend={onSend}
      isListening={false}
      onVoiceInput={vi.fn()}
      voiceSupported
      {...props}
    />
  );

  return { onSend, onChange };
};

describe("ChatComposer", () => {
  it("has an accessible label", () => {
    setup();
    expect(screen.getByLabelText(/message zenova/i)).toBeInTheDocument();
  });

  it("sends on Enter", async () => {
    const { onSend } = setup({ value: "hello" });

    await userEvent.type(screen.getByLabelText(/message zenova/i), "{Enter}");
    expect(onSend).toHaveBeenCalledOnce();
  });

  it("does not send on Shift+Enter", async () => {
    const { onSend } = setup({ value: "hello" });

    await userEvent.type(screen.getByLabelText(/message zenova/i), "{Shift>}{Enter}{/Shift}");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("disables send when the input is empty", () => {
    setup({ value: "   " });
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
  });

  it("hides the microphone when dictation is unsupported", () => {
    setup({ voiceSupported: false });
    expect(screen.queryByRole("button", { name: /speak/i })).not.toBeInTheDocument();
  });

  it("announces that it is listening", () => {
    setup({ isListening: true });
    expect(screen.getByRole("status")).toHaveTextContent(/listening/i);
  });
});
