/* One AudioContext. One chain per stem. One shared start timestamp.
   Nothing here interpolates in JavaScript — setTargetAtTime does it on the
   audio thread at sample rate, which is why a dropped frame is inaudible. */

export class AudioEngine {
  constructor({ tau = 0.3 } = {}) {
    this.tau = tau;
    this.ctx = null;
    this.channels = [];
    this.master = null;
    this.startedAt = null;
    this.loop = true;
  }

  get ready() { return !!this.ctx && this.channels.length > 0; }
  get position() { return this.startedAt == null ? 0 : Math.max(0, this.ctx.currentTime - this.startedAt); }

  async load(manifest, base, onProgress = () => {}) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) throw new Error('Web Audio is not available in this browser.');
    this.ctx = new Ctor();
    this.tau = manifest.audio.tau ?? this.tau;
    this.loop = manifest.audio.loop !== false;

    const chans = manifest.audio.channels;
    let done = 0;
    const steps = chans.length * 2;
    const tick = () => onProgress(++done / steps);

    const buffers = await Promise.all(chans.map(async c => {
      const res = await fetch(new URL(c.src, base));
      if (!res.ok) throw new Error(`${c.src} — HTTP ${res.status}`);
      const bytes = await res.arrayBuffer();
      tick();
      const buf = await this.ctx.decodeAudioData(bytes);
      tick();
      return buf;
    }));

    // master chain: sum → limiter → out. Four stems can briefly sum above unity.
    this.master = this.ctx.createGain();
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 12;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    this.master.connect(limiter).connect(this.ctx.destination);

    this.channels = chans.map((c, i) => {
      const gain = this.ctx.createGain();
      gain.gain.value = 0.0001;                    // silent until the first target lands
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800;
      filter.Q.value = 0.7;
      gain.connect(filter).connect(this.master);
      return { id: c.id, label: c.label, trim: c.trim ?? 1, buffer: buffers[i], gain, filter, source: null };
    });

    this.duration = buffers[0] ? buffers[0].duration : 0;
    this.sampleRate = this.ctx.sampleRate;
    return this;
  }

  /** Must be called from inside a user gesture. */
  async start() {
    if (!this.ready) throw new Error('start() before load()');
    if (this.ctx.state !== 'running') await this.ctx.resume();
    const t0 = this.ctx.currentTime + 0.12;        // lookahead so JS jitter cannot split the starts
    for (const c of this.channels) {
      const src = this.ctx.createBufferSource();
      src.buffer = c.buffer;
      src.loop = this.loop;
      src.connect(c.gain);
      src.start(t0);                               // identical t0 → sample-accurate, permanently
      c.source = src;
    }
    this.startedAt = t0;
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

  /** §12 null test: same stem twice, second copy polarity-flipped. Silence proves alignment. */
  nullTest(channelId, seconds = 4) {
    const c = this.channels.find(x => x.id === channelId);
    if (!c) return;
    const a = this.ctx.createBufferSource();
    const b = this.ctx.createBufferSource();
    a.buffer = b.buffer = c.buffer;
    const flip = this.ctx.createGain();
    flip.gain.value = -1;
    a.connect(this.ctx.destination);
    b.connect(flip).connect(this.ctx.destination);
    const t = this.ctx.currentTime + 0.1;
    a.start(t); b.start(t);
    a.stop(t + seconds); b.stop(t + seconds);
    console.info(`[null test] ${channelId}: should be silent for ${seconds}s`);
  }

  destroy() {
    for (const c of this.channels) { try { c.source && c.source.stop(); } catch (e) {} }
    this.channels = [];
    if (this.ctx) this.ctx.close();
    this.ctx = null;
  }
}
