import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Modal from "./Modal.jsx";

afterEach(() => {
  document.body.style.overflow = "";
  document.body.style.paddingRight = "";
});

const open = (props = {}) =>
  render(
    <Modal open onClose={props.onClose ?? (() => {})} labelledBy="t">
      <h2 id="t">How are you today?</h2>
      <button type="button">Great</button>
    </Modal>
  );

describe("Modal", () => {
  it("renders nothing when closed", () => {
    render(
      <Modal open={false} onClose={() => {}}>
        <p>hidden</p>
      </Modal>
    );
    expect(screen.queryByText("hidden")).toBeNull();
  });

  it("exposes itself as a labelled dialog", () => {
    open();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("How are you today?");
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    open({ onClose });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on a click outside the panel", () => {
    const onClose = vi.fn();
    const { container } = open({ onClose });

    fireEvent.mouseDown(container.firstChild);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stays open when the click lands inside the panel", () => {
    const onClose = vi.fn();
    open({ onClose });

    fireEvent.mouseDown(screen.getByRole("button", { name: "Great" }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("locks the page behind it and restores it on close", () => {
    const { unmount } = open();

    // Without this the page scrolls under the dialog.
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("");
  });
});
