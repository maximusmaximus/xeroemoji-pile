import { previewPathPrefix } from "@/lib/preview-path-prefix";
import { TOP_EMOJI_IDS } from "@/data/top500";

export const REPO_URL = "https://github.com/maximusmaximus/xeroemoji-pile";

export function emojiGlyph(id: string) {
  return id
    .split("-")
    .map((part) => String.fromCodePoint(Number.parseInt(part, 16)))
    .join("");
}

export type EmojiAsset = {
  id: string;
  name: string;
  url: string;
  size: number;
};

function toAsset(id: string): EmojiAsset {
  return { id, name: emojiGlyph(id), url: emojiUrl(id), size: 1 };
}

export function emojiUrl(id: string) {
  const path = `/api/emoji/${id}`;
  if (typeof window === "undefined") return path;
  const prefix = previewPathPrefix(window.location.hostname, window.location.pathname);
  return prefix ? `${prefix}${path}` : path;
}

// Unicode's 2019 median-frequency ranking, matched to Xero artwork. 500 only.
const TOP_IDS = TOP_EMOJI_IDS;

export async function loadEmojiLibrary(): Promise<EmojiAsset[]> {
  return TOP_IDS.map((id) => toAsset(id));
}
