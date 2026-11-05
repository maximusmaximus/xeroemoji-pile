import { previewPathPrefix } from "@/lib/preview-path-prefix";
import { TOP_EMOJI_IDS } from "@/data/top500";

export const REPO_URL = "https://github.com/maximusmaximus/xeroemoji-pile";

export type EmojiAsset = {
  id: string;
  name: string;
  url: string;
  size: number;
};

function hashSize(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 0.46 + ((h >>> 0) / 4294967295) * 0.5;
}

export function emojiUrl(id: string) {
  const path = `/api/emoji/${id}`;
  if (typeof window === "undefined") return path;
  const prefix = previewPathPrefix(window.location.hostname, window.location.pathname);
  return prefix ? `${prefix}${path}` : path;
}

function toAsset(id: string): EmojiAsset {
  return { id, name: id, url: emojiUrl(id), size: hashSize(id) };
}

// Unicode's 2019 median-frequency ranking, matched to Xero artwork. 500 only.
const TOP_IDS = TOP_EMOJI_IDS;

export async function loadEmojiLibrary(): Promise<EmojiAsset[]> {
  return TOP_IDS.map((id) => toAsset(id));
}
