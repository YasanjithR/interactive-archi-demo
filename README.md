# Common Ground — Stem Stage prototype

M83's *Solitude*, translated into a public interior. One track split into four
elements — chords, melody, reverb, vocals — re-balanced as you step through the
four architectural moves each element produced. The element in front rises; the
others duck **and** darken. The song never restarts.

**Renders are real. Audio is still placeholder** — synthesised stand-ins named
for the four elements, pending separation of the actual recording.

The four renders share one camera, so stepping reads as the space assembling
itself: structural walls → concrete → monumental volume → mirrored ceiling.
Because of that the stage uses `object-fit: contain` and applies no scale or pan
on transition — the images must register exactly, and cropping a symmetric
one-point perspective would destroy it.

---

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

One render per part in `content/panel-01/images/`, pointed at from `panel.json`.
Originals are kept in `content/panel-01/source/`.

Keep the camera identical across all of them. That is what makes the cross-fade
read as a build-up rather than a slideshow, and it is the strongest thing about
the current set.

The hero and part 04 deliberately share `04-mirrored-ceiling.jpeg`: you open on
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
