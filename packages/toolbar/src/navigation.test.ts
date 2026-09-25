// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import { holdNavigation, onNavigate } from "./navigation";

describe(holdNavigation, () => {
  it("patches history once and restores it when the last holder releases", () => {
    const { pushState, replaceState } = history;
    const first = holdNavigation();
    const patched = history.pushState;
    expect(patched).not.toBe(pushState);
    const second = holdNavigation();
    expect(history.pushState).toBe(patched);
    first();
    first();
    expect(history.pushState).toBe(patched);
    second();
    expect(history.pushState).toBe(pushState);
    expect(history.replaceState).toBe(replaceState);
  });

  it("keeps a wrapper another library installed on top of ours", () => {
    const original = history.pushState;
    const release = holdNavigation();
    const ours = history.pushState;
    const theirs: History["pushState"] = function theirs(
      this: History,
      ...args
    ) {
      ours.apply(this, args);
    };
    history.pushState = theirs;
    release();
    expect(history.pushState).toBe(theirs);
    history.pushState = original;
  });
});

describe(onNavigate, () => {
  it("fires after each URL change, once, and stops after unsubscribe", async () => {
    const release = holdNavigation();
    const seen: string[] = [];
    const off = onNavigate(() => seen.push(location.pathname));
    // Listeners run in a microtask queued by the patched call; awaiting one
    // resolved promise lets every queued notification run first.
    history.pushState(null, "", "/a");
    // Same URL: scroll-restoration style replaceState is not a navigation.
    history.replaceState({ scroll: 1 }, "", "/a");
    await Promise.resolve();
    history.replaceState(null, "", "/b");
    await Promise.resolve();
    off();
    history.pushState(null, "", "/c");
    await Promise.resolve();
    release();
    expect(seen).toStrictEqual(["/a", "/b"]);
  });
});
