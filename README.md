# xeroemoji-pile

A full-screen physics pile for the phone. The pile uses the 500 most-used emoji from [Unicode's 2019 frequency ranking](https://home.unicode.org/emoji/emoji-frequency/), in that order, drawn as [Xero Emoji](https://github.com/maximusmaximus/xeroemoji). Skin-tone and gender variants are not listed separately there, so they are not in the pile. Each visit drops a new random set. An emoji never falls twice.

Tilt the phone and gravity follows. Drag anything to move it. Hold one still and it bursts into colored shards. **More Emojis** drops the next unseen faces without clearing the pile. Each visit gets its own shuffle and a wave from 2× to 10× the original batch. The landing circle is twice as wide as the first version (four times the floor area). On a computer, arrow keys tilt and space shakes. The bulb on the left is the light. The **i** on the right opens this repo.

Live at [xerostuff.grok.me](https://xerostuff.grok.me/). Same pile as [simready-pile](https://github.com/maximusmaximus/simready-pile) and the later [SAND](https://sandpile.grok.me/) / [PIXELS](https://pixelpile.grok.me/) floors, with the props swapped for the Xero set only.

## Artwork

Emoji art loads from the Xero Emoji repo (SVG chrome in `public/xero/`, the 500 faces from the PNG set on jsDelivr). This repo does not redistribute the artwork.

| Source | Where |
| --- | --- |
| [maximusmaximus/xeroemoji](https://github.com/maximusmaximus/xeroemoji) | PNG and SVG for each id in `src/data/top500.ts` |

See that repo for the artwork license.

## Run

```
npm install
npm run dev
```
