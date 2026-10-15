"use client";

import { useRef, useState } from "react";
import { timeAgo } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Post } from "@/lib/types";
import { Avatar } from "./Avatar";
import { DemoBadge } from "./DemoBadge";
import { HeartIcon, PinIcon } from "./icons";

export function PostCard({ post, index }: { post: Post; index: number }) {
  const { me, userById, isFriend, toggleLike } = useStore();
  const author = userById(post.authorId);
  const liked = post.likedByMe;
  const [burst, setBurst] = useState(0);
  const [slide, setSlide] = useState(0);
  const lastTap = useRef(0);

  if (!author) return null;

  function onPhotoTap() {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!liked) toggleLike(post.id);
      setBurst((b) => b + 1);
    }
    lastTap.current = now;
  }

  return (
    <article
      className="animate-fade-up overflow-hidden rounded-[26px] border border-mint-100 bg-white shadow-[0_4px_20px_rgb(31_58_43/0.06)]"
      style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
    >
      <div className="flex items-center gap-3 px-4 pb-3 pt-4">
        <Avatar user={author} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-extrabold">{author.id === me.id ? "You" : author.name}</span>
            {isFriend(author.id) && (
              <span className="rounded-full bg-mint-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-mint-700">
                friend
              </span>
            )}
            <DemoBadge userId={author.id} />
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-ink-soft">
            <PinIcon size={12} />
            <span className="truncate">{post.place.name}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={new Date(post.createdAt).toISOString()}>{timeAgo(post.createdAt)}</time>
          </div>
        </div>
      </div>

      {post.photos.length > 0 && (
        <div className="relative">
          <div
            className="no-scrollbar flex aspect-[4/3] snap-x snap-mandatory overflow-x-auto bg-mint-100 focus-visible:outline-offset-[-3px]"
            tabIndex={post.photos.length > 1 ? 0 : undefined}
            role={post.photos.length > 1 ? "region" : undefined}
            aria-label={post.photos.length > 1 ? `${post.photos.length} photos, use arrow keys to scroll` : undefined}
            onScroll={(e) => {
              const el = e.currentTarget;
              setSlide(Math.round(el.scrollLeft / el.clientWidth));
            }}
            onClick={onPhotoTap}
          >
            {post.photos.map((src, i) => (
              // Photos come from Blob storage (or remote demo seeds) already sized for the feed, so next/image adds little here.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                alt={`Photo ${i + 1} of ${post.photos.length} from ${post.place.name}${post.caption ? `: ${post.caption.slice(0, 80)}` : ""}`}
                loading="lazy"
                draggable={false}
                className="h-full w-full shrink-0 snap-center object-cover"
              />
            ))}
          </div>
          {burst > 0 && (
            <span
              key={burst}
              className="pointer-events-none absolute inset-0 flex items-center justify-center text-white drop-shadow-lg"
            >
              <HeartIcon size={96} filled className="animate-heart" />
            </span>
          )}
          {post.photos.length > 1 && (
            <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
              {post.photos.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full bg-white transition-all duration-300 ${i === slide ? "w-4 opacity-100" : "w-1.5 opacity-60"}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="px-4 pb-4 pt-3">
        <button
          type="button"
          onClick={() => toggleLike(post.id)}
          aria-pressed={liked}
          aria-label={liked ? "Unlike" : "Like"}
          className={`press -ml-1.5 flex items-center gap-1.5 rounded-full px-1.5 py-1 text-sm font-bold ${liked ? "text-rose-600" : "text-ink-soft hover:text-rose-600"}`}
        >
          <HeartIcon size={22} filled={liked} className={liked ? "animate-pop" : ""} />
          {post.likeCount}
        </button>
        {post.caption && <p className="mt-1.5 text-[15px] leading-relaxed">{post.caption}</p>}
      </div>
    </article>
  );
}
