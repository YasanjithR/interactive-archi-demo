import { AudioEngine } from './audio/engine.js';
import { PROFILES, DEFAULT_PROFILE } from './audio/profiles.js';
import { flatten, resolve } from './nav/weights.js';
import { StepNavigator } from './nav/step.js';
import { createStage } from './view/stage.js';
import { createCaption } from './view/caption.js';
import { createHud } from './view/hud.js';
import { createReader } from './view/reader.js';
import { createGate } from './view/gate.js';

const PANEL = 'content/panel-01/panel.json';
const app = document.getElementById('app');

const setState = s => app.dataset.state = s;

function notice(msg) {
  const n = document.createElement('div');
  n.className = 'notice';
  n.textContent = msg;
  app.appendChild(n);
}

(async function boot() {
  const base = new URL(PANEL, location.href);
  let panel;
  try {
    const res = await fetch(base);
    if (!res.ok) throw new Error(`panel.json — HTTP ${res.status}`);
    panel = await res.json();
  } catch (e) {
    app.innerHTML = `<p class="fallback">Could not load the panel.<br>${e.message}<br><br>
      This needs to be served over http — opening index.html from the file system will not work.<br>
      Run <code>./serve.sh</code> and open the address it prints.</p>`;
    return;
  }

  // hero is node 0, then the flat list of parts
  const hero = { id: 'hero', label: panel.hero.label || panel.title, image: panel.hero.image,
                 body: panel.hero.body || '', hero: true, depth: 0 };
  const nodes = [hero, ...flatten(panel.sections)];
  const channels = panel.audio.channels;
  const channelIds = channels.map(c => c.id);
  const trims = Object.fromEntries(channels.map(c => [c.id, c.trim ?? 1]));
  const parts = nodes.length - 1;

  document.documentElement.style.setProperty('--tau', `${(panel.audio.tau ?? 0.3) * 1000}ms`);

  // ---------- view ----------
  const stage   = createStage(app, nodes, base);
  const caption = createCaption(app, channels);
  const reader  = createReader(app, panel.credit);
  const nav     = new StepNavigator(nodes);
  const hud     = createHud(app, channels, nodes, i => nav.go(i, 'index'));

  // profile switch
  const prof = document.createElement('div');
  prof.className = 'prof';
  prof.setAttribute('role', 'group');
  prof.setAttribute('aria-label', 'Playback profile');
  let profile = PROFILES[DEFAULT_PROFILE];
  const profBtns = Object.values(PROFILES).map(p => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = p.label;
    b.setAttribute('aria-pressed', String(p.id === profile.id));
    b.addEventListener('click', () => {
      profile = p;
      profBtns.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      apply(nav.index);
    });
    prof.appendChild(b);
    return b;
  });
  app.appendChild(prof);

  // controls
  const controls = document.createElement('div');
  controls.className = 'controls';
  const ICON_PAUSE = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="3" width="3" height="10" rx=".5"/><rect x="9" y="3" width="3" height="10" rx=".5"/></svg>';
  const ICON_PLAY  = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.2v9.6a.5.5 0 0 0 .77.42l7.2-4.8a.5.5 0 0 0 0-.84l-7.2-4.8A.5.5 0 0 0 5 3.2z"/></svg>';
  controls.innerHTML = `
    <button type="button" data-a="pause" class="icon" aria-label="Pause sound" aria-pressed="false" disabled>${ICON_PAUSE}</button>
    <button type="button" data-a="prev">Back</button>
    <button type="button" data-a="next">Next</button>
    <button type="button" data-a="read" class="read">Read</button>`;
  app.appendChild(controls);
  const btnPause = controls.querySelector('[data-a=pause]');
  const btnPrev = controls.querySelector('[data-a=prev]');
  const btnNext = controls.querySelector('[data-a=next]');
  const btnRead = controls.querySelector('[data-a=read]');
  btnPause.addEventListener('click', togglePause);
  btnPrev.addEventListener('click', () => nav.prev());
  btnNext.addEventListener('click', () => nav.next());
  btnRead.addEventListener('click', () => reader.toggle(btnRead));

  // ---------- audio ----------
  const engine = new AudioEngine({ tau: panel.audio.tau ?? 0.3 });
  let audioOk = false;
  let paused = false;

  // ctx.suspend() freezes currentTime, so the stems stay locked to each other
  // across a pause of any length — nothing to resync on resume.
  async function togglePause() {
    if (!audioOk) return;
    paused = !paused;
    try { paused ? await engine.suspend() : await engine.resume(); }
    catch (e) { paused = !paused; return; }
    btnPause.setAttribute('aria-pressed', String(paused));
    btnPause.setAttribute('aria-label', paused ? 'Resume sound' : 'Pause sound');
    btnPause.innerHTML = paused ? ICON_PLAY : ICON_PAUSE;
    document.body.dataset.paused = String(paused);
    if (!paused) nudge();
  }

  function apply(i) {
    const node = nodes[i];
    const { targets } = resolve({ nodes, activeIndex: i, channelIds, profile, trims });
    if (audioOk) engine.setTargets(targets);
    else hud.setLevels(Object.fromEntries(channelIds.map(id => [id, targets[id].weight])));
  }

  nav.onChange((node, i) => {
    stage.setActive(i);
    caption.set(node, i, parts);
    reader.set(node, i, parts);
    hud.setActive(i, node);
    btnPrev.disabled = nav.atStart;
    btnNext.disabled = nav.atEnd;
    btnNext.textContent = nav.atEnd ? 'Next' : `Next`;
    if (!node.hero) history.replaceState(null, '', '#' + node.id);
    else history.replaceState(null, '', location.pathname);
    apply(i);
  });

  // ---------- keyboard ----------
  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape' && reader.open) { reader.hide(); return; }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); nav.next(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); nav.prev(); }
    else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); togglePause(); }
    else if (e.key === 'Enter' && app.dataset.state === 'running') reader.toggle(btnRead);
    else if (/^[0-9]$/.test(e.key)) nav.go(Number(e.key), 'key');
  });

  // ---------- meter loop: only while a glide is settling ----------
  let raf = null, settleUntil = 0;
  function pump() {
    hud.setLevels(engine.getLevels());
    if (performance.now() < settleUntil) raf = requestAnimationFrame(pump);
    else raf = null;
  }
  function nudge() {
    settleUntil = performance.now() + (engine.tau * 1000 * 4);
    if (!raf) raf = requestAnimationFrame(pump);
  }
  nav.onChange(() => { if (audioOk && !paused) nudge(); });

  // ---------- gate ----------
  setState('gated');
  const gate = createGate(app, panel, async onProgress => {
    await engine.load(panel, base, onProgress);
    await engine.start();
    audioOk = true;
    btnPause.disabled = false;
    setState('running');
    gate.dismiss();
    nav.go(0, 'init');
    nudge();
    const missing = stage.failures();
    if (missing) notice(`${missing} image${missing > 1 ? 's' : ''} failed to load`);
  });
  gate.focus();

  // degraded: entering failed, but the piece still has to work
  addEventListener('unhandledrejection', () => {
    if (audioOk || app.dataset.state === 'degraded') return;
    setState('degraded');
    gate.dismiss();
    nav.go(0, 'init');
    notice('Sound unavailable — images and text only');
  });

  // deep link
  if (location.hash) {
    const i = nav.indexOfId(location.hash.slice(1));
    if (i > 0) nav.index = i;
  }

  // dev handle
  window.stemStage = { engine, nav, nodes, resolve, get profile() { return profile; } };
})();
