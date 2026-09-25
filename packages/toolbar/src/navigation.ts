type Listener = () => void;

interface Patch {
  pushState: History["pushState"];
  replaceState: History["replaceState"];
  patchedPush: History["pushState"];
  patchedReplace: History["replaceState"];
}

const listeners = new Set<Listener>();
let patch: Patch | null = null;
let holders = 0;
let lastHref = "";

/** Fire once per URL change, after the router's own call has returned. */
const notify = () => {
  queueMicrotask(() => {
    if (location.href === lastHref) {
      return;
    }
    lastHref = location.href;
    // Snapshot: a listener may unsubscribe while we iterate.
    // oxlint-disable-next-line no-useless-spread -- the copy is the point.
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        console.error(
          "[shadcn-labs-devtools] navigation listener failed",
          error
        );
      }
    }
  });
};

const install = () => {
  const { pushState, replaceState } = history;
  const patchedPush: History["pushState"] = function patchedPush(
    this: History,
    ...args
  ) {
    pushState.apply(this, args);
    notify();
  };
  const patchedReplace: History["replaceState"] = function patchedReplace(
    this: History,
    ...args
  ) {
    replaceState.apply(this, args);
    notify();
  };
  history.pushState = patchedPush;
  history.replaceState = patchedReplace;
  addEventListener("popstate", notify);
  lastHref = location.href;
  patch = { patchedPush, patchedReplace, pushState, replaceState };
};

const uninstall = () => {
  if (!patch) {
    return;
  }
  // Restore only what is still ours; a library that wrapped our patch since
  // would lose its own wrapper otherwise.
  if (history.pushState === patch.patchedPush) {
    history.pushState = patch.pushState;
  }
  if (history.replaceState === patch.patchedReplace) {
    history.replaceState = patch.replaceState;
  }
  removeEventListener("popstate", notify);
  patch = null;
};

/**
 * Keep `history` patched while at least one toolbar holds it. Returns the
 * release; the last release restores the original methods.
 */
export const holdNavigation = (): (() => void) => {
  holders += 1;
  if (!patch) {
    install();
  }
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    holders -= 1;
    if (holders === 0) {
      uninstall();
    }
  };
};

/** Subscribe to client-side navigation (push/replace/popstate). */
export const onNavigate = (listener: Listener): (() => void) => {
  const entry: Listener = () => listener();
  listeners.add(entry);
  return () => {
    listeners.delete(entry);
  };
};
