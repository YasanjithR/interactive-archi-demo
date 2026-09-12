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

### Three problems in the supplied exports

| | |
|---|---|
| `Track 1` in every song | Completely silent (−91 dB). Not the full mix — an empty track. Ignored. |
| `SOLITUDE / Drums` | Silent across all 222 s. **Common Ground runs on three stems**, not four. |
| `INNERBLOOM / Instruments` | Truncated to 20 s of a 253 s song. `Track 6` is full length and healthy, so that is used as the synth stem. |

Re-export any of these and re-run `encode_stems.sh` to fix.

### Memory

Real stems decode to roughly 46 MB each — a four-stem panel is ~180 MB in RAM.
The engine therefore **evicts the cache down to the current panel's set** on
every panel change. Holding all five would approach a gigabyte. The cost is a
re-download and re-decode when returning to a panel, which the loading state
covers.

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
