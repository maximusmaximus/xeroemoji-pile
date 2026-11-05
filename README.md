# xeroemoji-pile

A full-screen physics pile for the phone. Every object is a [Xero Emoji](https://github.com/maximusmaximus/xeroemoji). Each visit drops a new random set. An emoji never falls twice.

Tilt the phone and gravity follows. Drag anything to move it. **More Emojis** releases the next batch. The bulb on the left is the light. The **i** on the right opens this repo.

Same pile as [simready-pile](https://github.com/maximusmaximus/simready-pile), with the props swapped for the Xero set only.

## Artwork

Emoji art loads from the Xero Emoji repo (SVG chrome in `public/xero/`, falling faces from the PNG set on jsDelivr). This repo does not redistribute the 3,963-emoji library.

| Source | Where |
| --- | --- |
| [maximusmaximus/xeroemoji](https://github.com/maximusmaximus/xeroemoji) | `png/` and `svg/` on jsDelivr, catalog `demos/emoji-map.json` |

See that repo for the artwork license.

## Run

```
npm install
npm run dev
```
