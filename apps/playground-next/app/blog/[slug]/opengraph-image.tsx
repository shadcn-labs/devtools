import { ImageResponse } from "next/og";

import { findPost, POSTS } from "@/lib/posts";

export const alt = "Blog post";
export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

export const generateStaticParams = () =>
  POSTS.map((post) => ({ slug: post.slug }));

const Image = async ({ params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;
  const post = findPost(slug);
  return new ImageResponse(
    <div
      style={{
        background: "linear-gradient(135deg, #1e1b4b, #09090b)",
        color: "#fafafa",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "space-between",
        padding: 80,
        width: "100%",
      }}
    >
      <div style={{ color: "#a5b4fc", fontSize: 32 }}>Blog</div>
      <div style={{ fontSize: 76, fontWeight: 700 }}>
        {post?.title ?? "Not found"}
      </div>
      <div style={{ color: "#a1a1aa", fontSize: 30 }}>
        {post?.excerpt ?? ""}
      </div>
    </div>,
    size
  );
};

export default Image;
