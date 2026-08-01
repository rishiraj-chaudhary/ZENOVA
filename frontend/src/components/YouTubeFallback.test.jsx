import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import YouTubeFallback from "./YouTubeFallback.jsx";

const song = {
  title: "Weightless",
  artist: "Marconi Union",
};

describe("YouTubeFallback", () => {
  it("offers an inline preview when one was resolved", () => {
    render(<YouTubeFallback {...song} previewUrl="https://example.com/preview.m4a" />);

    // Spotify stopped publishing preview URLs, so every song had a dead audio
    // control until previews were sourced from iTunes.
    expect(
      screen.getByRole("button", { name: /play 30s preview/i })
    ).toBeInTheDocument();
  });

  it("offers only the link when no preview exists", () => {
    render(<YouTubeFallback {...song} />);

    expect(screen.queryByRole("button", { name: /preview/i })).toBeNull();
    expect(screen.getByRole("link")).toBeInTheDocument();
  });

  it("links straight to a known video rather than a search", () => {
    render(
      <YouTubeFallback {...song} watchUrl="https://www.youtube.com/watch?v=UfcAVejslrU" />
    );

    const link = screen.getByRole("link", { name: /play on youtube/i });
    expect(link).toHaveAttribute("href", "https://www.youtube.com/watch?v=UfcAVejslrU");
  });

  it("falls back to a search when there is no usable link", () => {
    render(<YouTubeFallback {...song} watchUrl="https://open.spotify.com/track/abc" />);

    // audioUrl holds a Spotify URL for most songs; sending the user there from
    // a YouTube button is what the old markup did.
    const link = screen.getByRole("link", { name: /find on youtube/i });
    expect(link.getAttribute("href")).toContain("youtube.com/results");
    expect(link.getAttribute("href")).toContain("Weightless");
  });

  it("names the song and artist so the card is readable without art", () => {
    render(<YouTubeFallback {...song} />);

    expect(screen.getByText("Weightless")).toBeInTheDocument();
    expect(screen.getByText("Marconi Union")).toBeInTheDocument();
  });
});
