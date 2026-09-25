import { useState } from "react";

const styles = {
  main: {
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
    lineHeight: 1.6,
    margin: "0 auto",
    maxWidth: "44rem",
    padding: "1.5rem",
  },
  muted: { opacity: 0.7 },
} as const;

export const App = () => {
  const [count, setCount] = useState(0);
  return (
    <main style={styles.main}>
      <h1>Shadcn Labs Playground (Vite)</h1>
      <p style={styles.muted}>
        The devtools toolbar is injected by <code>shadcnLabsDevtools()</code> in{" "}
        <code>vite.config.ts</code>. Toggle it with Alt+Shift+L.
      </p>
      <button onClick={() => setCount((value) => value + 1)} type="button">
        Clicked {count} times
      </button>
    </main>
  );
};
