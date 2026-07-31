import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CrisisSupport from "./CrisisSupport.jsx";

const RESOURCES = [
  {
    name: "Tele-MANAS",
    contact: "14416",
    url: "tel:14416",
    description: "India's national mental health helpline",
    available: "24/7",
  },
  {
    name: "Find A Helpline",
    contact: "findahelpline.com",
    url: "https://findahelpline.com",
    description: "Support lines in 130+ countries",
  },
];

describe("CrisisSupport", () => {
  it("announces itself assertively to screen readers", () => {
    render(<CrisisSupport resources={RESOURCES} notice="Emergency notice" />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
  });

  it("renders every contact as a usable link", () => {
    render(<CrisisSupport resources={RESOURCES} notice="Emergency notice" />);

    expect(screen.getByText("14416")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Tele-MANAS/ })).toHaveAttribute(
      "href",
      "tel:14416"
    );
    expect(screen.getByRole("link", { name: /Find A Helpline/ })).toHaveAttribute(
      "href",
      "https://findahelpline.com"
    );
  });

  it("shows the emergency notice", () => {
    render(<CrisisSupport resources={RESOURCES} notice="Contact emergency services" />);

    expect(screen.getByText("Contact emergency services")).toBeInTheDocument();
  });

  it("cannot be dismissed at crisis level", () => {
    const onDismiss = vi.fn();
    render(
      <CrisisSupport resources={RESOURCES} level="crisis" onDismiss={onDismiss} />
    );

    // Someone in crisis should not be one stray tap from losing the helpline.
    expect(
      screen.queryByRole("button", { name: /dismiss/i })
    ).not.toBeInTheDocument();
  });

  it("can be dismissed at elevated level", async () => {
    const onDismiss = vi.fn();
    render(
      <CrisisSupport resources={RESOURCES} level="elevated" onDismiss={onDismiss} />
    );

    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("renders nothing when there are no resources", () => {
    const { container } = render(<CrisisSupport resources={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
