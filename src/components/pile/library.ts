export const XERO_CDN = "https://cdn.jsdelivr.net/gh/maximusmaximus/xeroemoji@main";
export const REPO_URL = "https://github.com/maximusmaximus/xeroemoji-pile";

export type EmojiAsset = {
  id: string;
  name: string;
  url: string;
  size: number;
};

const FALLBACK_IDS = [
  "1f600", "1f602", "1f60d", "1f618", "1f92a", "1f973", "1f47b", "1f47d",
  "1f525", "1f4a5", "1f31f", "1f308", "1f355", "1f354", "1f369", "1f34e",
  "1f352", "1f98a", "1f436", "1f431", "1f981", "1f984", "1f680", "1f697",
  "1f3b8", "1f3a7", "1f48e", "1f381", "1f3c6", "1f44d", "1f64c", "1f9f8",
  "1f3b2", "2615", "1f37a", "1f942", "1f389", "1f388", "1f30d", "26a1",
  "2728", "1f31e", "1f319", "1f98b", "1f41d", "1f33b", "1f338", "1f451",
  "1f3ae", "1f4f8", "1f9e0", "1f9e1", "1f4a1", "2139",
];

function hashSize(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 0.46 + ((h >>> 0) / 4294967295) * 0.5;
}

import { previewPathPrefix } from "@/lib/preview-path-prefix";

export function emojiUrl(id: string) {
  const path = `/api/emoji/${id}`;
  if (typeof window === "undefined") return path;
  const prefix = previewPathPrefix(window.location.hostname, window.location.pathname);
  return prefix ? `${prefix}${path}` : path;
}

function toAsset(id: string, name?: string): EmojiAsset {
  return { id, name: name || id, url: emojiUrl(id), size: hashSize(id) };
}

export async function loadEmojiLibrary(): Promise<EmojiAsset[]> {
  try {
    const res = await fetch(`${XERO_CDN}/demos/emoji-map.json`);
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as Record<string, unknown>;
    const assets: EmojiAsset[] = [];
    for (const [key, row] of Object.entries(data)) {
      if (!Array.isArray(row)) continue;
      const id = typeof row[0] === "string" ? row[0] : key;
      const name = typeof row[2] === "string" ? row[2] : id;
      if (!/^[0-9a-f-]+$/i.test(id)) continue;
      assets.push(toAsset(id, name));
    }
    if (assets.length > 20) return assets;
  } catch {
    // The built-in set still fills the ring if the catalog cannot load.
  }
  return FALLBACK_IDS.map((id) => toAsset(id));
}
