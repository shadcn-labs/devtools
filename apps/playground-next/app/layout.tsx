import { ShadcnLabsDevtools } from "@shadcn-labs/devtools-next";
import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3100"),
  openGraph: {
    siteName: "Shadcn Labs Playground",
    type: "website",
  },
  title: {
    default: "Shadcn Labs Playground",
    template: "%s · Shadcn Labs Playground",
  },
  twitter: {
    card: "summary_large_image",
  },
};

const RootLayout = ({
  children,
}: Readonly<{
  children: ReactNode;
}>) => (
  <html lang="en">
    <body>
      <header className="site-header">
        <Link href="/">Home</Link>
        <Link href="/blog">Blog</Link>
        <Link href="/about">About</Link>
      </header>
      <main className="site-main">{children}</main>
      <ShadcnLabsDevtools />
    </body>
  </html>
);

export default RootLayout;
