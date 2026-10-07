# Reweave Cremorne — Stem Stage

Five spaces, five songs. Each space is built from the parts of its score, and
stepping through its sub-components re-balances the mix live: the element in
front rises, the others duck **and** darken. The song never restarts.

| Panel | Song |
|---|---|
| Reweave Cremorne — the neo-Brutalist exterior | *(track to be credited)* |
| The Atmosphere — the ground-floor lobby | Radiohead — Everything in Its Right Place |
| Common Ground — the public entrance | M83 — Solitude |
| The Transition Space — the garden | RÜFÜS DU SOL — Innerbloom |
| The Kaleidoscope — the workshop | Coldplay — Every Teardrop Is a Waterfall |

A landing gate opens onto a grid of the five; picking one enters the stepped
experience. Within each panel the renders share one camera, so stepping reads as
the space assembling itself rather than as a slideshow. That is why the stage
uses `object-fit: contain` and applies no scale or pan on transition — the
images must register exactly.

**Renders are real. Audio is still placeholder** — one shared set of four
synthesised stems in `content/_stems/`, which every panel maps its own channel
names onto. Replace per panel when the real recordings are separated.

## Install

There is nothing to install. No dependencies, no build step, no bundler.

```bash
npm start          # → http://localhost:8080
```

`package.json` lists zero dependencies — running `npm install` is harmless but
does nothing. The scripts are there so the project behaves the way you'd expect,
not because anything needs fetching.

If you'd rather not use node:

```bash
./serve.sh         # same thing, via python3
```

> Opening `index.html` by double-clicking will **not** work. Browsers block
> `fetch()` over `file://`, so the manifest and stems never load. It has to be
> served. This also means the demo works completely offline — it just needs a
> local server, not the internet.

### Why no dependencies

The whole runtime is Web Audio plus native ES modules, both built into the
browser. A bundler would add a toolchain, a lockfile, and a class of failure
right before a deadline, in exchange for nothing. If this ever grows to many
panels and wants routing, Vite drops in without touching `src/`.

---

## Everyday commands

| | |
|---|---|
| `npm start` | serve at http://localhost:8080 |
| `npm start -- 3000` | serve on another port |
| `npm test` | 13 unit tests over the weight maths |
| `npm run assets` | regenerate the placeholder stems and images |
| `npm run check` | tests plus a manifest parse |

---

## Controls

| | |
|---|---|
| Next / Back | step through the parts |
| → ← ↑ ↓ space | same, from the keyboard |
| `0`–`9` | jump straight to a part |
| Index, top right | jump to any part by name |
| Read, or Enter | open the description panel |
| Esc | close it |
| Phones / Room / Laptop | duck profile |

**Set the profile before you present.** The browser cannot detect what the sound
is coming out of, so it has to be a choice. Note that **Laptop** ducks harder on
gain but filters *higher* — a small driver reproduces almost nothing below
700 Hz, so filtering that low deletes the ducked bed instead of recessing it,
and the effect collapses from "behind glass" into "off".

---

## Swapping in real content

### Audio

```bash
python -m demucs -n htdemucs_ft solitude.wav
# rename the four outputs to chords / melody / reverb / vocals
cp *.wav /tmp/stemwork/
bash tools/prepare.sh real
```

Demucs gives `vocals / drums / bass / other`. This panel's four elements do not
map onto those one-to-one — *Solitude* carries its rhythm in sustained chords
rather than percussion, and "reverb" is a quality of the recording rather than a
separable part. Expect to map `vocals`→vocals, `other`→chords, and to decide by
ear which output best carries melody and which the reverberant tail.

`prepare.sh` prints each stem's loudness. Use those numbers to set `trim` in
`panel.json`, so that "all weights at 1.0" reconstructs the original mix —
separation output is **not** level-matched, and the vocals stem usually lands
several dB hot.

Stems are MP3, not AAC. Chromium builds without proprietary codecs cannot decode
AAC — a real browser refused to enter the demo, which is how this was found. All
four stems are encoded identically, so they share the same encoder delay and
stay perfectly aligned with each other.

### Images

One render per part in `content/<panel>/images/`, pointed at from that panel's
`panel.json`. Source material as delivered is kept in `Panels/` (in the repo,
excluded from deploys via `.assetsignore`).

Keep the camera identical across all of them. That is what makes the cross-fade
read as a build-up rather than a slideshow, and it is the strongest thing about
the current set.

In several panels the hero and the final part deliberately share an image: you open on
the finished space with everything playing, peel it back to the walls, and
return to it with only the vocals in front.

### The manifest

```jsonc
{
  "id": "low-register",
  "label": "The Low Register",
  "image": "images/part-01.svg",
  "focus": "bass",              // to the front; everything unnamed ducks to the floor
  "mix":   { "drums": 0.40 },   // …except this one, held partly up
  "body":  "Paragraphs separated by a blank line."
}
```

`focus` is shorthand so you're not hand-tuning N numbers per part. Reach for
`mix` only where you have an actual opinion.

---

## The running-order rule

There are more parts than stems, so two parts can share one. **If two adjacent
parts resolve to the same mix, stepping between them changes the image and the
text but nothing audible** — and the mechanic the whole piece exists to
demonstrate goes silent exactly when someone is watching for it.

Interleave them, or give them different beds:

```jsonc
{ "focus": "bass", "mix": { "drums": 0.40 } }   // the fins, against the rhythm
{ "focus": "bass", "mix": { "other": 0.40 } }   // the plinth, against the harmony
```

`npm test` enforces this. It fails rather than letting it ship quietly.

---

## Tuning the feel

`audio.tau` in `panel.json` is the transition time constant and the one
parameter that sets the character of the whole thing. 0.3 s settles in roughly
nine-tenths of a second. Short reads as decisive, long reads as ceremonial. Ten
minutes with the real stems will settle it faster than any amount of reasoning.
It drives the audio glide, the image cross-fade and the panel slide together.

## Verifying stem alignment

In the browser console once it's running:

```js
stemStage.engine.nullTest('bass')
```

Plays one stem twice with the second copy's polarity inverted. Silence proves
sample-accurate alignment; audible residue means a sample offset somewhere in
the encode chain.

---

## Layout

```
index.html
package.json           scripts only — no dependencies
src/
  main.js              controller, state machine, wiring
  audio/engine.js      node graph, scheduling, decode
  audio/profiles.js    the three duck profiles
  nav/step.js          which node is active, and when it changed
  nav/weights.js       pure maths — the only unit-tested file
  view/                stage, caption, hud, reader, gate, styles
content/panel-01/      panel.json + stems + images
tools/                 asset pipeline and the dev server
test/                  node --test
```

`src/` holds nothing panel-specific; `content/` holds nothing else. If you ever
edit a file under `src/` to add a panel, the abstraction has leaked.

## Housekeeping

`_to_delete/` holds zero-byte intermediates that couldn't be removed from this
side. Delete the folder yourself — nothing references it.


## Adding or changing a panel

`content/panels.json` is the index — id, title, kicker, blurb, cover and the
path to that panel's `panel.json`. **Paths in it resolve against `panels.json`
itself**, not the document root.

Each panel folder is self-contained: `panel.json` plus `images/`. Channel `src`
paths point at the shared `../_stems/` set for now; when a panel gets its own
separated stems, drop them in `content/<panel>/stems/` and change the `src`
values. Nothing under `src/` needs touching either way.

`npm test` validates every panel in the index: part counts agree with the index,
every `focus` and `mix` key names a real channel, and no two adjacent parts
resolve to the same mix.

## Routing

`#/<panel-id>` opens a panel; `#/<panel-id>/<section-id>` opens it at a
sub-component. Both are shareable and survive a reload — useful for sending an
assessor straight to one moment.

## The real stems

`STEMS/` holds the raw multitrack exports as delivered. `tools/encode_stems.sh`
turns one song's exports into the web set:

```bash
bash tools/encode_stems.sh "SOLITUDE" common-ground \
  bass="untitled - Bass.wav" chords="untitled - Instruments.wav" vocals="untitled - Vocals.wav"
```

It trims every stem to the **shortest common length** before encoding. The
exports differ by a few hundred samples, which is inaudible once but drifts
audibly over a loop. Output is mono 44.1 kHz MP3 at 96 kbps — about 3 MB per
stem, 12 MB per panel.

Trims are all `1.0`. These are true stems from one mix, so they already sum back
to the original: "all weights at 1.0" reconstructs the track, and correcting
levels would break that.

### Notes on the supplied exports

| | |
|---|---|
| `Track 1` in every song | Completely silent (−91 dB). Not the full mix — an empty track. Ignored. |
| `SOLITUDE / Drums` | Silent across all 222 s. **Common Ground runs on three stems**, not four. |
| `INNERBLOOM / Instruments` | Only 20 s long — **deliberately**, not truncated: it is the opening xylophone motif. `Track 6` is the full-length synth stem; the 20 s file is padded with silence to match and carried as a fifth channel, `Rhythm 2`. |

Re-export any of these and re-run `encode_stems.sh` to fix.

### Padding a short stem

A stem that covers only part of the song is padded with silence to the exact
common length rather than looped:

```bash
ffmpeg -i "Project_1 - Instruments.wav" -af apad -t 253.725193 \
  -ac 1 -ar 44100 -c:a libmp3lame -b:a 96k content/transition/stems/rhythm2.mp3
```

It then sounds across the song's first 20 s and falls silent, staying correctly
positioned on every loop. Looping it instead would repeat the motif twelve times
over a track that only states it once.

### Memory

Real stems decode to roughly 46 MB each — a four-stem panel is ~180 MB in RAM.
The engine therefore **evicts the cache down to the current panel's set** on
every panel change. Holding all five would approach a gigabyte. The cost is a
re-download and re-decode when returning to a panel, which the loading state
covers.

## The Archive tab

The home screen carries two tabs: **Panels** (the five spaces) and **Archive**
(the drawings, writing and film behind them). The archive is lazy — nothing is
fetched until the tab is first opened. `#/archive` deep-links to it.

Three viewers behind one overlay:

| Kind | Viewer |
|---|---|
| `pages` | the document as page images in a continuous scroll — no PDF plugin |
| `video` | a `<video>` with VP9/WebM and H.264/MP4 sources |
| `wall` | the three presentation boards hung end to end |

### Why page images and not a PDF

The first build put each PDF in an `<iframe>` and let the browser render it.
On a machine with Chrome's **"Download PDFs instead of automatically opening
them"** switched on, that iframe is blank and the file lands in Downloads —
the viewer opens onto nothing. The setting is per-user and per-machine, so the
crit laptop decides whether the archive works, which is not a bet worth taking.

Each document is now rasterised to page JPEGs (`tools/make_pages.sh`) and
listed in `archive.json` with its pixel size, which goes onto the page wrapper
as an `aspect-ratio` so the full scroll height is correct before a single image
has loaded. The first two pages load eagerly, the rest lazily.

Two sizes, toggled from the toolbar: a comfortable 62 rem column for reading,
and full window width for detail. A one-page sheet (the A1 masterplan) starts
whole-page instead, because a plan read a column at a time is not a plan.

| Document | Pages | Page images |
|---|---|---|
| Research Portfolio | 44 | 6.3 MB |
| Process Portfolio | 34 | 4.5 MB |
| Cremorne Masterplan | 1 | 1.6 MB |

The archive cards no longer print a file size. A size tells you how big the
thing you are about to download is, and nothing here is downloadable.

The page counter is plain `scrollTop` arithmetic against each page's
`offsetTop`, coalesced to a frame — not an `IntersectionObserver`. Same answer,
no threshold tuning, and one pass over 44 offsets costs nothing.

### The wall

The three Masterclass boards share a height and were made to be pinned side by
side, so they are not a folder of three PDFs. They are shown as one continuous
**21,610 × 2,186 px** strip you drag along, with a scrubber marking which board
you are in front of and a zoom for reading board text. A folder would have lost
the only thing that makes them a set.

Each board is sliced into segments no wider than 4,200 px so no single image
decode exceeds ~10 MP — board 02 alone is 12,348 px wide.

### Preparing archive assets

Originals live in `content/pdfs/` (gitignored — 363 MB) and are processed into
`content/archive/`:

```bash
bash tools/flatten_pdf.sh "content/pdfs/AT 01.pdf" \
     content/archive/docs/process-portfolio.pdf 120 72
```

**Why rasterise rather than downsample?** Ghostscript leaves images with soft
masks at full resolution — `AT 01.pdf` went 47 MB → 41 MB and no further, at
any dpi. Rasterising trades text selection for a predictable size, which is the
right trade for visual portfolios: 47 MB → 6.1 MB.

Totals: the seven source files are **363 MB**, five of them over Cloudflare's
25 MiB per-asset limit. Processed, `content/archive/` is **68 MB** with nothing
over 18 MB: 29 MB film (shipped twice), 21 MB download PDFs, 13 MB page images,
5 MB boards.

### Nothing is downloadable

The archive shows the work; it does not hand it out. There is no download
button anywhere, the film's native controls are built without one
(`controlsList="nodownload"`, no picture-in-picture, no cast), right-click on
an image or the film is suppressed inside the viewer, and dragging a page out
of the window does nothing.

`archive.json` names no PDF at all. A path left in the manifest is a URL anyone
can read straight off the wire whether or not a button points at it, so the
source PDFs are stripped from it *and* excluded from the deploy
(`/content/archive/docs/` in `.assetsignore`). They stay in the repo for
re-running `make_pages.sh`; they are simply never uploaded, so there is no URL
to guess. It also takes 21 MB off the site.

**This is a deterrent, not protection.** Anything the browser renders it has
already fetched, and the network tab will always hand it over. What it removes
is every route a visitor would actually take. A test enforces all of it, so a
download link cannot creep back in unnoticed.

The film ships twice, VP9 first. H.264 is absent from Chromium builds without
the licensed decoder — the same gap that forced the stems to MP3 — so the
browser picks whichever it can decode.

## Panel entry

A panel's stems are ~12 MB, so entry does not block on them.

The panel mounts immediately — images, caption, index and description are all
usable within a couple of hundred milliseconds, and the meter falls back to
showing each part's *intended* weights so the mechanic reads before a byte of
audio has arrived. Stems load behind a thin progress line at the top edge, and
when they land the mix jumps straight to whichever part the reader has stepped
to, not back to the hero.

Hovering or tabbing to a grid card fires a `<link rel="prefetch">` for that
panel's stems — cache warming only, no decode, so no memory cost. Measured on a
throttled 6 Mbit connection: cold click, panel on screen in 245 ms and sound at
23.7 s; after ~1.8 s of hover, on screen in 62 ms and sound at 2.9 s.

Leaving a panel before its audio lands is guarded by a load counter, so a slow
response can never start playback into a panel the reader has already left.

## Publishing with real audio

The repo is private and the use is academic, so the encoded stems (~59 MB) are
tracked. The raw 1.1 GB `STEMS/` exports are not — keep those backed up
elsewhere; they are only needed to re-run `encode_stems.sh`.

**A private repo does not make the deployed site private.** Cloudflare Pages
serves whatever it builds to a public URL regardless of the repo's visibility,
so the recordings would be publicly fetchable from `.pages.dev`.

If that matters, put the site behind **Cloudflare Access** — Zero Trust → Access
→ Applications, with an email one-time-code policy listing your assessors. It
takes a couple of minutes and keeps the link shareable with exactly the people
who need it.
