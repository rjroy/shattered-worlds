/**
 * Opens a URL in the system browser, never inside the game canvas. Wrapped in
 * its own function (rather than inlined at each call site) so REQ-W13-33 is
 * independently testable: mock `window.open` and assert the call args.
 */
export function openExternalLink(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}
