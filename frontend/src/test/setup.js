import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

/** Storage is origin-dependent in jsdom, so never assume it exists. */
const clearStorage = (storage) => {
  try {
    storage?.clear?.();
  } catch {
    // An opaque origin throws on access; nothing to clear in that case.
  }
};

afterEach(() => {
  cleanup();
  clearStorage(globalThis.sessionStorage);
  clearStorage(globalThis.localStorage);
  vi.clearAllMocks();
});

// jsdom implements neither, and components under test call both.
window.scrollTo = vi.fn();
Element.prototype.scrollIntoView = vi.fn();

globalThis.IntersectionObserver = class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
};
