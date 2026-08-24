/* Pure weight resolution. No DOM, no Web Audio — unit-testable in plain node.
   Pipeline:  A one-hot focus → B depth sharpen → C blend → D profile map. */

export const KAPPA = 0.8;

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Depth-first flatten. Nesting is unused in the flat MVP but the loader supports it. */
export function flatten(sections, depth = 0, out = []) {
  for (const s of sections) {
    out.push({ ...s, depth });
    if (s.children && s.children.length) flatten(s.children, depth + 1, out);
  }
  return out;
}

/** Expand `focus` shorthand into a full per-channel mix. Explicit `mix` wins. */
export function nodeMix(node, channelIds) {
  const m = {};
  for (const id of channelIds) m[id] = node.hero ? 1 : 0;
  if (node.focus != null) {
    for (const id of [].concat(node.focus)) if (id in m) m[id] = 1;
  }
  if (node.mix) {
    for (const [k, v] of Object.entries(node.mix)) if (k in m) m[k] = clamp01(v);
  }
  return m;
}

/** Deeper nodes duck their siblings harder. Identity at depth 0. */
export function sharpen(mix, depth = 0, kappa = KAPPA) {
  if (!depth) return { ...mix };
  const p = 1 + kappa * depth;
  const out = {};
  for (const [k, v] of Object.entries(mix)) out[k] = Math.pow(v, p);
  return out;
}

export function oneHot(active, n) {
  return Array.from({ length: n }, (_, i) => (i === active ? 1 : 0));
}

/** Convex combination — w stays inside the range of the declared mixes. */
export function blend(focusWeights, mixes, channelIds) {
  const w = {};
  for (const id of channelIds) w[id] = 0;
  for (let i = 0; i < focusWeights.length; i++) {
    const F = focusWeights[i];
    if (!F) continue;
    for (const id of channelIds) w[id] += F * (mixes[i][id] ?? 0);
  }
  return w;
}

/** Weight → perceptual gain (dB) and lowpass cutoff (log-interpolated Hz). */
export function mapProfile(w, profile) {
  const u = Math.pow(clamp01(w), profile.k);
  const db = profile.floorDb * (1 - u);
  return {
    db,
    gain: Math.pow(10, db / 20),
    cutoff: profile.fmin * Math.pow(profile.fmax / profile.fmin, u)
  };
}

/** Full resolve. Returns per-channel targets ready for the engine. */
export function resolve({ nodes, activeIndex, channelIds, profile, trims = {}, kappa = KAPPA }) {
  const F = oneHot(activeIndex, nodes.length);
  const mixes = nodes.map(n => sharpen(nodeMix(n, channelIds), n.depth || 0, kappa));
  const weights = blend(F, mixes, channelIds);
  const targets = {};
  for (const id of channelIds) {
    const m = mapProfile(weights[id], profile);
    targets[id] = {
      weight: weights[id],
      db: m.db,
      gain: m.gain * (trims[id] ?? 1),
      cutoff: m.cutoff
    };
  }
  return { focus: F, weights, targets };
}
