import type { Metadata } from "next";

export const metadata: Metadata = {
  description: "A Next.js App Router playground for the Shadcn Labs devtools.",
  openGraph: {
    description: "Try the toolbar, the registry browser and the OG audit.",
    title: "Shadcn Labs Playground",
  },
};

const HomePage = () => (
  <>
    <h1>Shadcn Labs Playground</h1>
    <p className="muted">
      Open the devtools toolbar (Alt+Shift+L) to browse the registries and audit
      this page&apos;s Open Graph tags. Its image comes from{" "}
      <code>app/opengraph-image.tsx</code>.
    </p>
  </>
);

export default HomePage;
