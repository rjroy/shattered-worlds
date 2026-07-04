import { afterEach, describe, expect, it, mock } from "bun:test";

import { openExternalLink } from "./externalLink";

describe("openExternalLink (REQ-W13-33)", () => {
  const originalOpen = window.open;

  afterEach(() => {
    window.open = originalOpen;
  });

  it("opens the URL in a new tab with noopener,noreferrer", () => {
    const spy = mock(() => null);
    window.open = spy as unknown as typeof window.open;

    openExternalLink("https://findahelpline.com/");

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("https://findahelpline.com/", "_blank", "noopener,noreferrer");
  });

  it("passes through whatever URL it is given, unmodified", () => {
    const spy = mock(() => null);
    window.open = spy as unknown as typeof window.open;

    openExternalLink("https://988.ca/");

    expect(spy).toHaveBeenCalledWith("https://988.ca/", "_blank", "noopener,noreferrer");
  });
});
