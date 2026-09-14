/* One AudioContext for the life of the page. One chain per stem. One shared
   start timestamp.

   Nothing here interpolates in JavaScript — setTargetAtTime does it on the
   audio thread at sample rate, which is why a dropped frame is inaudible.

   Buffers are cached by resolved URL, so panels that share stem files switch
   instantly and browsers never see a second AudioContext (they cap a page at
   roughly six). */

export class AudioEngine {
  constructor({ tau = 0.3 } = {}) {
    this.tau = tau;
    this.ctx = null;
    this.master = null;
    this.limiter = null;
    this.channels = [];
    this.startedAt = null;
    this.loop = true;
    this.cache = new Map();          // resolved URL → AudioBuffer
  }

  get ready() { return !!this.ctx && this.channels.length > 0; }
  get position() { return this.startedAt == null ? 0 : Math.max(0, this.ctx.currentTime - this.startedAt); }

  /** Must first be called from inside a user gesture. */
  ensureContext() {
    if (!this.ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) throw new Error('Web Audio is not available in this browser.');
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      const lim = this.ctx.createDynamicsCompressor();
      lim.threshold.value = -6; lim.knee.value = 12; lim.ratio.value = 6;
      lim.attack.value = 0.003; lim.release.value = 0.25;
      this.master.connect(lim).connect(this.ctx.destination);
      this.limiter = lim;
    }
    return this.ctx;
  }

  /** Fetch + decode anything not already cached. */
  async prefetch(srcs, base, onProgress = () => {}) {
    this.ensureContext();
    const urls = [...new Set(srcs.map(s => new URL(s, base).href))].filter(u => !this.cache.has(u));
    if (!urls.length) { onProgress(1); return; }
    let done = 0;
    const steps = urls.length * 2;
    const tick = () => onProgress(++done / steps);
    await Promise.all(urls.map(async url => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url.split('/').pop()} — HTTP ${res.status}`);
      const bytes = await res.arrayBuffer();
      tick();
      this.cache.set(url, await this.ctx.decodeAudioData(bytes));
      tick();
    }));
  }

  /** Tear down the previous panel's chains and wire this manifest's.

      Real stems decode to ~46 MB each, so the cache is evicted down to just
      this panel's set BEFORE fetching. Holding five panels at once would be
      close to a gigabyte; the cost is a re-decode when returning to a panel. */
  async configure(manifest, base, onProgress = () => {}) {
    const wanted = new Set(manifest.audio.channels.map(c => new URL(c.src, base).href));
    this.stop();
    for (const url of [...this.cache.keys()]) if (!wanted.has(url)) this.cache.delete(url);
    await this.prefetch(manifest.audio.channels.map(c => c.src), base, onProgress);
    this.tau  = manifest.audio.tau ?? this.tau;
    this.loop = manifest.audio.loop !== false;
    this.channels = manifest.audio.channels.map(c => {
      const gain = this.ctx.createGain();
      gain.gain.value = 0.0001;              // never exactly 0 — see the exponential approach below
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800;
      filter.Q.value = 0.7;
      gain.connect(filter).connect(this.master);
      return {
        id: c.id, label: c.label, trim: c.trim ?? 1,
        buffer: this.cache.get(new URL(c.src, base).href),
        gain, filter, source: null
      };
    });
    this.duration = this.channels[0] ? this.channels[0].buffer.duration : 0;
    this.sampleRate = this.ctx.sampleRate;
    return this;
  }

  async start() {
    if (!this.channels.length) throw new Error('start() before configure()');
    if (this.ctx.state !== 'running') await this.ctx.resume();
    const t0 = this.ctx.currentTime + 0.12;   // lookahead so JS jitter cannot split the starts
    for (const c of this.channels) {
      const src = this.ctx.createBufferSource();
      src.buffer = c.buffer;
      src.loop = this.loop;
      src.connect(c.gain);
      src.start(t0);                          // identical t0 → sample-accurate, permanently
      c.source = src;
    }
    this.startedAt = t0;
  }

  /** Restart every stem from zero, spliced cleanly.

      Sources are single-use, so this builds fresh ones. The master is dipped
      to near-silence across the splice: cutting mid-waveform with the gains
      open produces a very audible click, and with four or five stems cutting
      at once it is a thump. ~80 ms down, restart, ~80 ms back up — reads as a
      deliberate re-cue rather than a glitch. */
  restart() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const DIP = 0.08;
    const t0  = now + DIP + 0.02;

    const g = this.master.gain;
    g.cancelScheduledValues(now);              // a rapid second press re-aims cleanly
    g.setValueAtTime(Math.max(g.value, 1e-4), now);
    g.exponentialRampToValueAtTime(1e-4, now + DIP);

    for (const c of this.channels) {
      try { c.source && c.source.stop(t0); } catch (e) {}
      const src = ctx.createBufferSource();
      src.buffer = c.buffer;
      src.loop = this.loop;
      src.connect(c.gain);
      src.start(t0);                           // same t0 for all — still sample-accurate
      c.source = src;
    }
    this.startedAt = t0;
    g.exponentialRampToValueAtTime(1, t0 + DIP);
  }

  stop() {
    for (const c of this.channels) {
      try { c.source && c.source.stop(); } catch (e) {}
      try { c.source && c.source.disconnect(); c.gain.disconnect(); c.filter.disconnect(); } catch (e) {}
    }
    this.channels = [];
    this.startedAt = null;
  }

  setTargets(targets) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    for (const c of this.channels) {
      const t = targets[c.id];
      if (!t) continue;
      c.gain.gain.setTargetAtTime(Math.max(t.gain, 1e-4), now, this.tau);
      c.filter.frequency.setTargetAtTime(t.cutoff, now, this.tau);
    }
  }

  /** Live values mid-glide — the HUD reads the real graph, not a parallel model. */
  getLevels() {
    const out = {};
    for (const c of this.channels) out[c.id] = c.gain.gain.value / (c.trim || 1);
    return out;
  }

  async suspend() { if (this.ctx && this.ctx.state === 'running') await this.ctx.suspend(); }
  async resume()  { if (this.ctx && this.ctx.state !== 'running') await this.ctx.resume(); }

  /** Alignment proof: same stem twice, second copy polarity-flipped → silence. */
  nullTest(channelId, seconds = 4) {
    const c = this.channels.find(x => x.id === channelId);
    if (!c) return;
    const a = this.ctx.createBufferSource(), b = this.ctx.createBufferSource();
    a.buffer = b.buffer = c.buffer;
    const flip = this.ctx.createGain();
    flip.gain.value = -1;
    a.connect(this.ctx.destination);
    b.connect(flip).connect(this.ctx.destination);
    const t = this.ctx.currentTime + 0.1;
    a.start(t); b.start(t); a.stop(t + seconds); b.stop(t + seconds);
    console.info(`[null test] ${channelId}: should be silent for ${seconds}s`);
  }

  destroy() { this.stop(); if (this.ctx) this.ctx.close(); this.ctx = null; this.cache.clear(); }
}
