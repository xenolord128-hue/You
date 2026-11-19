import React, { useState } from 'react';
import { BLOG_POSTS } from '../config/storeConfig';
import { BlogPost } from '../types/ecommerce';
import { SeoHead } from '../components/SeoHead';

export const BlogPage: React.FC = () => {
  const [activePost, setActivePost] = useState<BlogPost | null>(null);

  return (
    <main className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 py-6 sm:py-8 lg:py-12 pb-20 sm:pb-16">
      <SeoHead
        title="Journal — PYTHOX WORLD"
        description="Men's styling guides, fabric notes, and lookbook essays from PYTHOX WORLD."
      />

      <div className="border-b border-[#D9D9D9] pb-8">
        <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.2em] text-[#5C5C5C]">
          PYTHOX WORLD Journal
        </p>
        <h1 className="mt-2 text-3xl sm:text-5xl font-editorial font-semibold text-[#0A0A0A]">
          Men&apos;s Style &amp; Fabric Notes
        </h1>
      </div>

      {activePost ? (
        <article className="mt-8 sm:mt-10 max-w-3xl mx-auto space-y-6">
          <button
            type="button"
            onClick={() => setActivePost(null)}
            className="btn-base btn-secondary btn-sm"
          >
            Back to All Articles
          </button>
          <div className="text-xs font-mono text-[#5C5C5C] flex flex-wrap items-center gap-2">
            <span>{activePost.category}</span>
            <span aria-hidden="true">·</span>
            <span>{activePost.publishedAt}</span>
            <span aria-hidden="true">·</span>
            <span>{activePost.readTime}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-editorial font-semibold text-[#0A0A0A]">
            {activePost.title}
          </h2>
          <div className="aspect-[16/10] rounded-3xl border border-[#D9D9D9] bg-[#EAE9E4] overflow-hidden">
            <img
              src={activePost.image}
              alt={activePost.title}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="space-y-4 text-base text-[#292929] leading-relaxed">
            {activePost.content.map((para, idx) => (
              <p key={idx}>{para}</p>
            ))}
          </div>
        </article>
      ) : (
        <div className="mt-8 sm:mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {BLOG_POSTS.map((post) => (
            <article key={post.id} className="group flex flex-col">
              <button
                type="button"
                onClick={() => setActivePost(post)}
                className="text-left cursor-pointer"
              >
                <div className="aspect-[4/3] rounded-3xl border border-[#D9D9D9] bg-[#EAE9E4] overflow-hidden">
                  <img
                    src={post.image}
                    alt={post.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="pt-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#5C5C5C]">
                    <span>{post.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{post.publishedAt}</span>
                    <span aria-hidden="true">·</span>
                    <span>{post.readTime}</span>
                  </div>
                  <h2 className="text-xl font-editorial font-semibold text-[#0A0A0A] group-hover:underline underline-offset-4">
                    {post.title}
                  </h2>
                  <p className="text-sm text-[#292929] leading-relaxed">
                    {post.excerpt}
                  </p>
                </div>
              </button>
            </article>
          ))}
        </div>
      )}
    </main>
  );
};
