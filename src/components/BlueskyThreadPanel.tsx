import { useState, useEffect } from "react";

interface BskyAuthor {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

interface BskyPost {
  uri: string;
  author: BskyAuthor;
  record: { text: string; createdAt: string };
  likeCount?: number;
  replyCount?: number;
  repostCount?: number;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(iso));
}

export default function BlueskyThreadPanel({ eventUrl }: { eventUrl: string }) {
  const [posts, setPosts] = useState<BskyPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(eventUrl)}&limit=10`
    )
      .then((r) => r.json())
      .then((data: { posts?: BskyPost[] }) => {
        setPosts(data.posts ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [eventUrl]);

  if (loading || posts.length === 0) return null;

  return (
    <section
      style={{
        marginTop: "2.5rem",
        paddingTop: "2rem",
        borderTop: "2px dashed var(--color-rule)",
      }}
    >
      <h2
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          fontSize: "var(--text-xl)",
          marginBottom: "1.25rem",
        }}
      >
        <svg
          aria-hidden="true"
          width="18"
          height="16"
          viewBox="0 0 360 320"
          fill="#0085ff"
          aria-hidden="true"
        >
          <path d="M180 142c-16.3-31.7-60.7-90.8-102-120C38 2 15.3 1 7.5 1 1 1 0 8.3 0 14.8v11.3c0 27.3 14.7 96.2 62.3 119.4C99.3 163.8 148.7 164 180 164c31.3 0 80.7-.2 117.7-18.5C345.3 122.3 360 53.4 360 26.1V14.8C360 8.3 359 1 352.5 1c-7.8 0-30.5 1-70.5 21C240.7 51.2 196.3 110.3 180 142z" />
          <path d="M180 178c-16.3 31.7-60.7 90.8-102 120-40 20-62.7 21-70.5 21C1 319 0 311.7 0 305.2v-11.3c0-27.3 14.7-96.2 62.3-119.4C99.3 156.2 148.7 156 180 156c31.3 0 80.7.2 117.7 18.5C345.3 197.7 360 266.6 360 293.9v11.3c0 6.5-1 13.8-7.5 13.8-7.8 0-30.5-1-70.5-21-41.3-29.2-85.7-88.3-102-120z" />
        </svg>
        People are talking about this
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        {posts.map((post) => {
          const parts = post.uri.split("/");
          const bskyUrl = `https://bsky.app/profile/${parts[2]}/post/${parts[4]}`;

          return (
            <a
              key={post.uri}
              href={bskyUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block",
                background: "var(--color-paper)",
                border: "1.5px solid var(--color-rule)",
                borderRadius: "var(--radius-md)",
                padding: "0.875rem 1rem",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "0.375rem",
                }}
              >
                {post.author.avatar ? (
                  <img
                    src={post.author.avatar}
                    alt=""
                    width={28}
                    height={28}
                    style={{
                      borderRadius: "50%",
                      border: "1.5px solid var(--color-rule)",
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "#0085ff",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {(post.author.displayName ?? post.author.handle)
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )}
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: "var(--text-sm)",
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {post.author.displayName ?? `@${post.author.handle}`}
                </span>
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--color-muted)",
                    flexShrink: 0,
                  }}
                >
                  {timeAgo(post.record.createdAt)}
                </span>
              </div>

              <p
                style={{
                  margin: 0,
                  fontSize: "var(--text-sm)",
                  lineHeight: 1.55,
                  color: "var(--color-ink)",
                }}
              >
                {post.record.text}
              </p>

              {(post.likeCount || post.replyCount || post.repostCount) && (
                <div
                  style={{
                    display: "flex",
                    gap: "1rem",
                    marginTop: "0.5rem",
                    fontSize: "var(--text-xs)",
                    color: "var(--color-muted)",
                  }}
                >
                  {post.replyCount != null && (
                    <span>{post.replyCount} {post.replyCount === 1 ? "reply" : "replies"}</span>
                  )}
                  {post.repostCount != null && (
                    <span>🔁 {post.repostCount}</span>
                  )}
                  {post.likeCount != null && (
                    <span>♥ {post.likeCount}</span>
                  )}
                </div>
              )}
            </a>
          );
        })}
      </div>
    </section>
  );
}
