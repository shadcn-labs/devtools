import type { Metadata } from "next";
import Link from "next/link";

import { POSTS } from "@/lib/posts";

export const metadata: Metadata = {
  description: "Notes on Open Graph images and registry components.",
  title: "Blog",
};

const BlogPage = () => (
  <>
    <h1>Blog</h1>
    <ul>
      {POSTS.map((post) => (
        <li key={post.slug}>
          <Link href={`/blog/${post.slug}`}>{post.title}</Link>{" "}
          <span className="muted">{post.date}</span>
        </li>
      ))}
    </ul>
  </>
);

export default BlogPage;
