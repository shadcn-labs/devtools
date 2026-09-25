import type { Metadata } from "next";

// No `description` on purpose: the OG audit should flag this page.
export const metadata: Metadata = {
  openGraph: {
    images: [{ height: 630, url: "/api/og?title=About", width: 1200 }],
    title: "About",
  },
  title: "About",
};

const AboutPage = () => (
  <>
    <h1>About</h1>
    <p className="muted">
      This page&apos;s image is served by the <code>app/api/og/route.tsx</code>{" "}
      route handler, and it deliberately has no description.
    </p>
  </>
);

export default AboutPage;
