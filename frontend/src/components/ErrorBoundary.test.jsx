import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ErrorBoundary from "./ErrorBoundary.jsx";

const Boom = () => {
  throw new Error("render exploded");
};

describe("ErrorBoundary", () => {
  beforeEach(() => {
    // React logs caught errors; silence it so the output stays readable.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>
    );

    expect(screen.getByText("all good")).toBeInTheDocument();
  });

  it("shows a fallback instead of blanking the app", () => {
    render(
      <ErrorBoundary label="the chat">
        <Boom />
      </ErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/couldn't display the chat/i)).toBeInTheDocument();
  });

  it("offers recovery actions", () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );

    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /go home/i })).toBeInTheDocument();
  });

  it("clears the error when resetKey changes", () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="/a">
        <Boom />
      </ErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();

    // Navigating to another route must not leave the user stuck on the fallback.
    rerender(
      <ErrorBoundary resetKey="/b">
        <p>recovered</p>
      </ErrorBoundary>
    );

    expect(screen.getByText("recovered")).toBeInTheDocument();
  });

  it("supports a custom fallback", () => {
    render(
      <ErrorBoundary fallback={(error) => <p>custom: {error.message}</p>}>
        <Boom />
      </ErrorBoundary>
    );

    expect(screen.getByText(/custom: render exploded/)).toBeInTheDocument();
  });
});
