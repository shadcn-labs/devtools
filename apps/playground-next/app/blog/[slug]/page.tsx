import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { findPost, POSTS } from "@/lib/posts";

interface PostPageProps {
  params: Promise<{ slug: string }>;
}

export const generateStaticParams = () =>
  POSTS.map((post) => ({ slug: post.slug }));

export const generateMetadata = async ({
  params,
}: PostPageProps): Promise<Metadata> => {
  const { slug } = await params;
  const post = findPost(slug);
  if (!post) {
    return {};
  }
  return {
    description: post.excerpt,
    openGraph: {
      description: post.excerpt,
      publishedTime: post.date,
      title: post.title,
      type: "article",
    },
    title: post.title,
    twitter: {
      card: "summary_large_image",
      description: post.excerpt,
      title: post.title,
    },
  };
};

const PostPage = async ({ params }: PostPageProps) => {
  const { slug } = await params;
  const post = findPost(slug);
  if (!post) {
    notFound();
  }
  return (
    <article>
      <h1>{post.title}</h1>
      <p className="muted">{post.date}</p>
      <p>{post.excerpt}</p>
    </article>
  );
};

export default PostPage;
