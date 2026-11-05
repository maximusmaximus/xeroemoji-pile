import { createFileRoute } from "@tanstack/react-router";

const ID = /^[0-9a-f]+(?:-[0-9a-f]+)*$/i;
const cache = new Map<string, { type: string; body: ArrayBuffer }>();
const CACHE_MAX = 480;

const FALLBACK = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="36" fill="#e39b2b"/><circle cx="80" cy="80" r="28" fill="#fff6e8"/></svg>`;

function sources(id: string) {
  return [
    [`https://cdn.jsdelivr.net/gh/maximusmaximus/xeroemoji@main/png/${id}.png`, "image/png"],
    [`https://cdn.jsdelivr.net/gh/maximusmaximus/xeroemoji@main/svg/${id}.svg`, "image/svg+xml"],
    [`https://raw.githubusercontent.com/maximusmaximus/xeroemoji/main/png/${id}.png`, "image/png"],
    [`https://raw.githubusercontent.com/maximusmaximus/xeroemoji/main/svg/${id}.svg`, "image/svg+xml"],
  ] as const;
}

async function pull(url: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (res.ok) {
        const body = await res.arrayBuffer();
        if (body.byteLength > 64) return body;
      }
    } catch {
      // try the next host
    }
    await new Promise((resolve) => setTimeout(resolve, 120 * (attempt + 1)));
  }
  return null;
}

function remember(id: string, type: string, body: ArrayBuffer) {
  if (cache.has(id)) cache.delete(id);
  cache.set(id, { type, body });
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

export const Route = createFileRoute("/api/emoji/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = params.id.toLowerCase();
        if (!ID.test(id) || id.length > 160) {
          return new Response("bad id", { status: 400 });
        }
        const hit = cache.get(id);
        if (hit) {
          return new Response(hit.body, {
            headers: {
              "content-type": hit.type,
              "cache-control": "public, max-age=86400",
            },
          });
        }
        for (const [url, type] of sources(id)) {
          const body = await pull(url);
          if (!body) continue;
          remember(id, type, body);
          return new Response(body, {
            headers: {
              "content-type": type,
              "cache-control": "public, max-age=86400",
            },
          });
        }
        return new Response(FALLBACK, {
          headers: {
            "content-type": "image/svg+xml",
            "cache-control": "public, max-age=300",
          },
        });
      },
    },
  },
});
