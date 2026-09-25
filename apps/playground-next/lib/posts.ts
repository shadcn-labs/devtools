export interface Post {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
}

export const POSTS: Post[] = [
  {
    date: "2026-09-01",
    excerpt: "Render social cards from React components with Satori.",
    slug: "hello-og-images",
    title: "Hello, OG images",
  },
  {
    date: "2026-09-12",
    excerpt: "Why every route deserves its own opengraph-image file.",
    slug: "per-route-images",
    title: "Per-route images",
  },
];

export const findPost = (slug: string): Post | undefined =>
  POSTS.find((post) => post.slug === slug);
