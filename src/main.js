import { AudioEngine } from './audio/engine.js';
import { PROFILES, DEFAULT_PROFILE } from './audio/profiles.js';
import { flatten, resolve } from './nav/weights.js';
import { StepNavigator } from './nav/step.js';
import { createStage } from './view/stage.js';
import { createCaption } from './view/caption.js';
import { createHud } from './view/hud.js';
import { createReader } from './view/reader.js';
import { createGate } from './view/gate.js';
import { createGrid } from './view/grid.js';

const INDEX = 'content/panels.json';
const app = document.getElementById('app');
const setState = s => { app.dataset.state = s; };

function notice(msg) {
  const n = document.createElement('div');
  n.className = 'notice';
  n.textContent = msg;
  app.appendChild(n);
  setTimeout(() => n.remove(), 6000);
}

const ICON_PAUSE = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="3" width="3" height="10" rx=".5"/><rect x="9" y="3" width="3" height="10" rx=".5"/></svg>';
const ICON_PLAY  = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.2v9.6a.5.5 0 0 0 .77.42l7.2-4.8a.5.5 0 0 0 0-.84l-7.2-4.8A.5.5 0 0 0 5 3.2z"/></svg>';

(async function boot() {
  const base = new URL(INDEX, location.href);
  let index;
  try {
    const res = await fetch(base);
    if (!res.ok) throw new Error(`panels.json — HTTP ${res.status}`);
    index = await res.json();
  } catch (e) {
    app.innerHTML = `<p class="fallback">Could not load the panels.<br>${e.message}<br><br>
      This needs to be served over http — opening index.html from the file system will not work.<br>
      Run <code>npm start</code> and open the address it prints.</p>`;
    return;
  }

  const engine = new AudioEngine();
  let profile = PROFILES[DEFAULT_PROFILE];
  let audioOk = false;
  let paused = false;
  let live = null;                       // the mounted panel, or null on the grid
  let loadSeq = 0;                       // guards audio landing after the reader moved on

  // ---------- panel host ----------
  const host = document.createElement('div');
  host.className = 'panel-host';
  host.hidden = true;
  app.appendChild(host);

  const grid = createGrid(app, index, base, id => openPanel(id, true), warmPanel);

  // A panel's stems are ~12 MB. The visuals must not wait for them, so audio
  // loads in the background behind a thin progress line at the top edge.
  const loadLine = document.createElement('div');
  loadLine.className = 'loadline';
  loadLine.hidden = true;
  loadLine.innerHTML = '<i></i>';
  app.appendChild(loadLine);
  const loadBar = loadLine.querySelector('i');
  const showLoader = () => { loadBar.style.width = '0%'; loadLine.hidden = false; };
  const hideLoader = () => { loadLine.hidden = true; };

  // panel.json is tiny; cache it so hover costs one small request, not a wait
  const manifestCache = new Map();
  async function getManifest(entry) {
    if (!manifestCache.has(entry.id)) {
      const pBase = new URL(entry.path, base);
      const res = await fetch(pBase);
      if (!res.ok) throw new Error(`${entry.path} — HTTP ${res.status}`);
      manifestCache.set(entry.id, { panel: await res.json(), pBase });
    }
    return manifestCache.get(entry.id);
  }

  // Warm the browser's HTTP cache only — no decode, so no JS heap cost.
  // configure() then finds the bytes already local and only has to decode.
  const warmed = new Set();
  async function warmPanel(id) {
    if (warmed.has(id)) return;
    warmed.add(id);
    const entry = index.panels.find(p => p.id === id);
    if (!entry) return;
    try {
      const { panel, pBase } = await getManifest(entry);
      for (const c of panel.audio.channels) {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.as = 'audio';
        link.href = new URL(c.src, pBase).href;
        document.head.appendChild(link);
      }
    } catch (e) { warmed.delete(id); }
  }

  // ---------- profile switch (global — survives panel changes) ----------
  const prof = document.createElement('div');
  prof.className = 'prof';
  prof.hidden = true;
  prof.setAttribute('role', 'group');
  prof.setAttribute('aria-label', 'Playback profile');
  const profBtns = Object.values(PROFILES).map(p => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = p.label;
    b.setAttribute('aria-pressed', String(p.id === profile.id));
    b.addEventListener('click', () => {
      profile = p;
      profBtns.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      if (live) apply(live.nav.index);
    });
    prof.appendChild(b);
    return b;
  });
  app.appendChild(prof);

  // ---------- meter pump: only while a glide settles ----------
  let raf = null, settleUntil = 0;
  function pump() {
    if (live) live.hud.setLevels(engine.getLevels());
    if (performance.now() < settleUntil) raf = requestAnimationFrame(pump);
    else raf = null;
  }
  function nudge() {
    settleUntil = performance.now() + engine.tau * 1000 * 4;
    if (!raf) raf = requestAnimationFrame(pump);
  }

  function apply(i) {
    if (!live) return;
    const { targets } = resolve({
      nodes: live.nodes, activeIndex: i, channelIds: live.channelIds, profile, trims: live.trims
    });
    if (audioOk) engine.setTargets(targets);
    else live.hud.setLevels(Object.fromEntries(live.channelIds.map(id => [id, targets[id].weight])));
  }

  async function togglePause() {
    if (!audioOk || !live) return;
    paused = !paused;
    try { paused ? await engine.suspend() : await engine.resume(); }
    catch (e) { paused = !paused; return; }
    live.btnPause.setAttribute('aria-pressed', String(paused));
    live.btnPause.setAttribute('aria-label', paused ? 'Resume sound' : 'Pause sound');
    live.btnPause.innerHTML = paused ? ICON_PLAY : ICON_PAUSE;
    document.body.dataset.paused = String(paused);
    if (!paused) nudge();
  }

  // ---------- mount / unmount a panel ----------
  function unmountPanel() {
    loadSeq++;
    engine.stop();
    // the next panel has no audio until its own stems land — without this the
    // meter stays blank instead of falling back to showing intended weights
    audioOk = false;
    host.innerHTML = '';
    host.hidden = true;
    prof.hidden = true;
    live = null;
    paused = false;
    document.body.dataset.paused = 'false';
    document.body.dataset.reader = 'false';
  }

  async function openPanel(id, pushHash) {
    const entry = index.panels.find(p => p.id === id);
    if (!entry) return;

    unmountPanel();
    grid.hide();
    setState('loading-panel');

    const seq = ++loadSeq;
    let panel, pBase;
    try { ({ panel, pBase } = await getManifest(entry)); }
    catch (e) { notice(`Could not load ${entry.title}`); backToGrid(); return; }
    if (seq !== loadSeq) return;

    document.documentElement.style.setProperty('--tau', `${(panel.audio.tau ?? 0.3) * 1000}ms`);

    const hero = { id: 'hero', label: panel.hero.label || panel.title, image: panel.hero.image,
                   body: panel.hero.body || '', hero: true, depth: 0 };
    const nodes = [hero, ...flatten(panel.sections)];
    const channels = panel.audio.channels;
    const channelIds = channels.map(c => c.id);
    const trims = Object.fromEntries(channels.map(c => [c.id, c.trim ?? 1]));
    const parts = nodes.length - 1;

    host.hidden = false;
    prof.hidden = false;
    const stage   = createStage(host, nodes, pBase);
    const caption = createCaption(host, channels);
    const reader  = createReader(host, panel.credit);
    const nav     = new StepNavigator(nodes);
    const hud     = createHud(host, channels, nodes, i => nav.go(i, 'index'));

    const controls = document.createElement('div');
    controls.className = 'controls';
    controls.innerHTML = `
      <button type="button" data-a="back" class="icon back" aria-label="All panels">
        <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2.5" width="5.2" height="5.2" rx="1"/><rect x="8.8" y="2.5" width="5.2" height="5.2" rx="1"/><rect x="2" y="9.3" width="5.2" height="4.2" rx="1"/><rect x="8.8" y="9.3" width="5.2" height="4.2" rx="1"/></svg>
      </button>
      <button type="button" data-a="pause" class="icon" aria-label="Pause sound" aria-pressed="false">${ICON_PAUSE}</button>
      <button type="button" data-a="prev">Back</button>
      <button type="button" data-a="next">Next</button>
      <button type="button" data-a="read" class="read">Read</button>`;
    host.appendChild(controls);

    const btnBack  = controls.querySelector('[data-a=back]');
    const btnPause = controls.querySelector('[data-a=pause]');
    const btnPrev  = controls.querySelector('[data-a=prev]');
    const btnNext  = controls.querySelector('[data-a=next]');
    const btnRead  = controls.querySelector('[data-a=read]');

    btnBack.addEventListener('click', backToGrid);
    btnPause.addEventListener('click', togglePause);
    btnPrev.addEventListener('click', () => nav.prev());
    btnNext.addEventListener('click', () => nav.next());
    btnRead.addEventListener('click', () => reader.toggle(btnRead));

    live = { id, panel, nodes, channelIds, trims, nav, stage, caption, reader, hud, btnPause, btnRead, parts };

    nav.onChange((node, i) => {
      stage.setActive(i);
      caption.set(node, i, parts);
      reader.set(node, i, parts);
      hud.setActive(i, node);
      btnPrev.disabled = nav.atStart;
      btnNext.disabled = nav.atEnd;
      setHash(id, node.hero ? null : node.id);
      apply(i);
      if (audioOk && !paused) nudge();
    });

    // Visuals first: the panel is usable and readable before a byte of audio
    // has arrived. apply() falls back to showing intended weights on the meter
    // while audioOk is false, so the mechanic is legible immediately.
    setState('running');
    document.body.dataset.screen = 'panel';
    nav.go(0, 'init');

    showLoader();
    engine.configure(panel, pBase, p => { loadBar.style.width = (p * 100).toFixed(0) + '%'; })
      .then(() => {
        if (seq !== loadSeq) { engine.stop(); return; }   // reader left before it landed
        return engine.start();
      })
      .then(() => {
        if (seq !== loadSeq) return;
        audioOk = true;
        apply(nav.index);          // catch up to wherever they stepped meanwhile
        nudge();
      })
      .catch(() => { if (seq === loadSeq) notice('Sound unavailable — images and text only'); })
      .finally(() => { if (seq === loadSeq) hideLoader(); });

    const missing = stage.failures();
    if (missing) notice(`${missing} image${missing > 1 ? 's' : ''} failed to load`);
    if (pushHash) btnNext.focus();
  }

  function backToGrid() {
    unmountPanel();
    grid.show();
    setState('grid');
    setHash(null);
  }

  // ---------- routing ----------
  let suppressHash = false;
  function setHash(panelId, sectionId) {
    suppressHash = true;
    const h = !panelId ? '' : '#/' + panelId + (sectionId ? '/' + sectionId : '');
    history.replaceState(null, '', h || location.pathname);
    setTimeout(() => { suppressHash = false; }, 0);
  }
  function parseHash() {
    const m = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    return { panel: m[0] || null, section: m[1] || null };
  }
  addEventListener('hashchange', () => {
    if (suppressHash) return;
    const { panel, section } = parseHash();
    if (!panel) { if (live) backToGrid(); return; }
    if (!live || live.id !== panel) openPanel(panel, false).then(() => {
      if (section && live) live.nav.goId(section, 'hash');
    });
    else if (section) live.nav.goId(section, 'hash');
  });

  // ---------- keyboard ----------
  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (!live) return;
    if (e.key === 'Escape') {
      if (live.reader.open) live.reader.hide(); else backToGrid();
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); live.nav.next(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); live.nav.prev(); }
    else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); togglePause(); }
    else if (e.key === 'Enter') live.reader.toggle(live.btnRead);
    else if (/^[0-9]$/.test(e.key)) live.nav.go(Number(e.key), 'key');
  });

  // ---------- gate ----------
  setState('gated');
  const gate = createGate(app, index, async onProgress => {
    // The gate exists to unlock audio, not to download it — each panel fetches
    // its own stems on entry, with its own progress.
    engine.ensureContext();
    await engine.resume();
    onProgress(1);
    gate.dismiss();
    const { panel, section } = parseHash();
    if (panel && index.panels.some(p => p.id === panel)) {
      await openPanel(panel, false);
      if (section && live) live.nav.goId(section, 'hash');
    } else {
      grid.show();
      setState('grid');
    }
  });
  gate.focus();

  window.stemStage = { engine, index, resolve, get live() { return live; }, get profile() { return profile; } };
})();
