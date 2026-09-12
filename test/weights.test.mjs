/* node --test test/  — zero dependencies. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flatten, nodeMix, sharpen, oneHot, blend, mapProfile, resolve } from '../src/nav/weights.js';
import { PROFILES } from '../src/audio/profiles.js';

const IDS = ['bass', 'drums', 'lead', 'pad'];
const P = PROFILES.room;

test('focus shorthand and its expanded mix resolve identically', () => {
  const short = nodeMix({ focus: 'bass' }, IDS);
  const long  = nodeMix({ mix: { bass: 1, drums: 0, lead: 0, pad: 0 } }, IDS);
  assert.deepEqual(short, long);
});

test('multiple focus stems both reach full', () => {
  const m = nodeMix({ focus: ['bass', 'lead'] }, IDS);
  assert.equal(m.bass, 1); assert.equal(m.lead, 1);
  assert.equal(m.drums, 0); assert.equal(m.pad, 0);
});

test('explicit mix overrides the shorthand', () => {
  const m = nodeMix({ focus: 'bass', mix: { drums: 0.4 } }, IDS);
  assert.equal(m.bass, 1); assert.equal(m.drums, 0.4);
});

test('hero opens every channel at full', () => {
  assert.deepEqual(nodeMix({ hero: true }, IDS), { bass: 1, drums: 1, lead: 1, pad: 1 });
});

test('focus weights are one-hot and sum to 1', () => {
  const F = oneHot(2, 5);
  assert.equal(F.reduce((a, b) => a + b, 0), 1);
  assert.equal(F[2], 1);
});

test('depth sharpening is identity at depth 0 and monotonic below it', () => {
  const m = { bass: 1, drums: 0.3 };
  assert.deepEqual(sharpen(m, 0), m);
  const d1 = sharpen(m, 1), d2 = sharpen(m, 2);
  assert.equal(d1.bass, 1);                       // a focused stem is untouched
  assert.ok(d1.drums < m.drums);
  assert.ok(d2.drums < d1.drums);
});

test('blend never exceeds the largest declared mix', () => {
  const mixes = [{ bass: 1, drums: 0.3 }, { bass: 0.2, drums: 1 }];
  const w = blend([0.5, 0.5], mixes, ['bass', 'drums']);
  assert.ok(w.bass <= 1 && w.drums <= 1);
  assert.ok(Math.abs(w.bass - 0.6) < 1e-9);
});

test('profile map: weight 1 is unity gain, weight 0 is the floor', () => {
  const hi = mapProfile(1, P), lo = mapProfile(0, P);
  assert.ok(Math.abs(hi.db) < 1e-9);
  assert.ok(Math.abs(hi.gain - 1) < 1e-9);
  assert.equal(lo.db, P.floorDb);
  assert.ok(Math.abs(lo.cutoff - P.fmin) < 1e-6);
  assert.ok(Math.abs(hi.cutoff - P.fmax) < 1e-6);
});

test('the laptop profile ducks harder but filters HIGHER', () => {
  const room = PROFILES.room, lap = PROFILES.lap;
  assert.ok(lap.floorDb < room.floorDb, 'harder gain duck');
  assert.ok(lap.fmin > room.fmin, 'higher filter floor keeps the bed audible on a small driver');
});

test('resolve produces one target per channel with the trim applied', () => {
  const nodes = [{ id: 'a', focus: 'bass', depth: 0 }, { id: 'b', focus: 'drums', depth: 0 }];
  const r = resolve({ nodes, activeIndex: 0, channelIds: IDS, profile: P, trims: { bass: 0.5 } });
  assert.equal(Object.keys(r.targets).length, IDS.length);
  assert.ok(Math.abs(r.targets.bass.gain - 0.5) < 1e-9);   // unity × trim
  assert.ok(r.targets.drums.gain < r.targets.bass.gain);
});

test('flatten derives depth from structure', () => {
  const f = flatten([{ id: 'a', children: [{ id: 'a1' }] }, { id: 'b' }]);
  assert.deepEqual(f.map(n => [n.id, n.depth]), [['a', 0], ['a1', 1], ['b', 0]]);
});

test('every panel in the index resolves, and its parts name channels that exist', async () => {
  const { readFileSync } = await import('node:fs');
  const idxUrl = new URL('../content/panels.json', import.meta.url);
  const idx = JSON.parse(readFileSync(idxUrl));
  assert.ok(idx.panels.length > 0, 'index lists no panels');
  for (const entry of idx.panels) {
    const pUrl = new URL(entry.path, idxUrl);
    const p = JSON.parse(readFileSync(pUrl));
    const ids = new Set(p.audio.channels.map(c => c.id));
    assert.equal(p.sections.length, entry.parts, `${entry.id}: index part count disagrees with the manifest`);
    for (const s of p.sections) {
      for (const f of [].concat(s.focus || []))
        assert.ok(ids.has(f), `${entry.id}/${s.id}: unknown focus stem "${f}"`);
      for (const k of Object.keys(s.mix || {}))
        assert.ok(ids.has(k), `${entry.id}/${s.id}: unknown mix stem "${k}"`);
    }
  }
});

test('no panel has two consecutive parts that resolve to the same mix', async () => {
  // The running-order rule. Two adjacent parts driven by the same stem with the
  // same supporting mix produce a step with no audible change — at which point
  // the mechanic the piece exists to show goes silent.
  const { readFileSync } = await import('node:fs');
  const idxUrl = new URL('../content/panels.json', import.meta.url);
  const idx = JSON.parse(readFileSync(idxUrl));
  for (const entry of idx.panels) {
    const p = JSON.parse(readFileSync(new URL(entry.path, idxUrl)));
    const ids = p.audio.channels.map(c => c.id);
    const sig = s => JSON.stringify(nodeMix(s, ids));
    for (let i = 1; i < p.sections.length; i++) {
      assert.notEqual(
        sig(p.sections[i]), sig(p.sections[i - 1]),
        `${entry.id}: "${p.sections[i - 1].id}" and "${p.sections[i].id}" resolve to the same mix — ` +
        `stepping between them changes nothing audible. Interleave them, or vary the bed.`
      );
    }
  }
});
