/* The Archive tab: the drawings, writing and film that sit behind the panels.

   Three viewers behind one overlay:
     pdf    the browser's own PDF viewer in an iframe — no library, works offline
     video  a plain <video> element
     wall   the three presentation boards hung end to end and walked along

   The wall is the reason this isn't just a list of download links. The boards
   share a height and were made to be pinned side by side, so they are shown as
   one 21,610px strip you drag through, with a scrubber marking where you are
   across the three. A folder of PDFs would lose exactly the thing that makes
   them a set. */

export function createArchive(paneRoot, overlayRoot, data, base, { onBusy } = {}) {
  const el = document.createElement('div');
  el.className = 'archive-screen';
  el.hidden = true;

  // ── cards ────────────────────────────────────────────────────────────────
  const list = document.createElement('div');
  list.className = 'arc-grid';
  for (const it of data.items) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'arc-card';
    card.dataset.kind = it.kind;
    card.setAttribute('aria-label', `${it.title} — ${it.meta}`);
    card.innerHTML = `
      <span class="arc-thumb">
        <img src="${new URL(it.cover, base).href}" alt="" loading="lazy" decoding="async">
        <span class="arc-badge">${badge(it.kind)}</span>
      </span>
      <span class="arc-meta">
        <span class="arc-title">${it.title}</span>
        <span class="arc-blurb">${it.blurb || ''}</span>
        <span class="arc-foot"><span>${it.meta}</span></span>
      </span>`;
    card.addEventListener('click', () => open(it));
    list.appendChild(card);
  }
  el.appendChild(list);
  paneRoot.appendChild(el);

  // ── overlay ──────────────────────────────────────────────────────────────
  const ov = document.createElement('div');
  ov.className = 'arc-viewer';
  ov.hidden = true;
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.innerHTML = `
    <header class="arc-bar">
      <span class="arc-bar-title"></span>
      <span class="arc-bar-tools"></span>
      <button type="button" class="arc-close">Close ESC</button>
    </header>
    <div class="arc-stage"></div>`;
  overlayRoot.appendChild(ov);

  // Nothing in the archive is offered for download. This is a deterrent, not
  // protection — anything the browser renders it has already fetched, and the
  // network tab will always hand it over. It removes the obvious routes:
  // no save-image context menu, no drag-to-desktop.
  ov.addEventListener('contextmenu', e => {
    if (e.target.closest('img, video')) e.preventDefault();
  });
  ov.addEventListener('dragstart', e => e.preventDefault());

  const barTitle = ov.querySelector('.arc-bar-title');
  const barTools = ov.querySelector('.arc-bar-tools');
  const stage    = ov.querySelector('.arc-stage');
  let opener = null, cleanup = null;

  function badge(k) { return k === 'video' ? 'Film' : k === 'wall' ? 'Boards' : 'Document'; }

  function open(it) {
    opener = document.activeElement;
    barTitle.textContent = it.title;
    barTools.innerHTML = '';
    stage.innerHTML = '';
    if (cleanup) { cleanup(); cleanup = null; }

    if (it.kind === 'pages')      cleanup = mountPages(it);
    else if (it.kind === 'video') cleanup = mountVideo(it);
    else if (it.kind === 'wall')  cleanup = mountWall(it);

    ov.hidden = false;
    document.body.dataset.viewer = 'true';
    onBusy && onBusy(true);
    ov.querySelector('.arc-close').focus();
  }

  function close() {
    if (cleanup) { cleanup(); cleanup = null; }
    stage.innerHTML = '';
    ov.hidden = true;
    document.body.dataset.viewer = 'false';
    onBusy && onBusy(false);
    if (opener && opener.focus) opener.focus();
  }

  // ── paged document ───────────────────────────────────────────────────────
  // Not an <iframe> of the PDF. Chrome has a setting that downloads PDFs
  // rather than opening them, and iOS Safari frequently refuses to render one
  // in a frame — both give a blank overlay. Page images always render.
  function mountPages(it) {
    const zoomBtn = document.createElement('button');
    zoomBtn.type = 'button';
    zoomBtn.className = 'arc-tool';

    const count = document.createElement('span');
    count.className = 'arc-count';

    barTools.append(count, zoomBtn);

    const wrap = document.createElement('div');
    wrap.className = 'arc-reader';
    const col = document.createElement('div');
    col.className = 'arc-reader-col';

    const imgs = it.pages.map((pg, i) => {
      const fig = document.createElement('div');
      fig.className = 'arc-page';
      fig.style.aspectRatio = `${pg.w} / ${pg.h}`;
      const img = document.createElement('img');
      img.src = new URL(pg.src, base).href;
      img.alt = `${it.title} — page ${i + 1}`;
      img.decoding = 'async';
      img.loading = i < 2 ? 'eager' : 'lazy';
      img.draggable = false;
      fig.appendChild(img);
      col.appendChild(fig);
      return fig;
    });
    wrap.appendChild(col);
    stage.appendChild(wrap);

    // 'read' is a comfortable measure; 'full' fills the viewport width;
    // a single large sheet starts whole-page so the drawing reads as one thing
    let mode = it.single ? 'fit' : 'read';
    const apply = () => {
      wrap.dataset.mode = mode;
      zoomBtn.textContent = mode === 'full' ? (it.single ? 'Fit page' : 'Fit width') : 'Zoom in';
      zoomBtn.setAttribute('aria-pressed', String(mode === 'full'));
    };
    zoomBtn.addEventListener('click', () => {
      mode = it.single ? (mode === 'fit' ? 'full' : 'fit')
                       : (mode === 'read' ? 'full' : 'read');
      apply();
    });
    apply();

    // Page counter: whichever page crosses the middle of the reader. Plain
    // scrollTop arithmetic rather than an IntersectionObserver — one pass over
    // 44 offsetTop reads, coalesced to a frame, is cheaper than 44 observers
    // and gives the same answer without threshold tuning.
    let current = -1, queued = false;
    const paint = () => {
      queued = false;
      const mid = wrap.scrollTop + wrap.clientHeight / 2;
      let i = 0;
      while (i + 1 < imgs.length && imgs[i + 1].offsetTop <= mid) i++;
      if (i === current) return;
      current = i;
      count.textContent = `${i + 1} / ${it.pages.length}`;
    };
    const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(paint); } };
    wrap.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(onScroll);
    ro.observe(wrap);
    paint();

    return () => { wrap.removeEventListener('scroll', onScroll); ro.disconnect(); };
  }

  // ── video ────────────────────────────────────────────────────────────────
  function mountVideo(it) {
    const v = document.createElement('video');
    v.className = 'arc-video';
    v.controls = true;
    v.preload = 'metadata';
    v.playsInline = true;
    // No download item in the native control set, and no picture-in-picture or
    // cast — both hand the file to something outside the page.
    v.setAttribute('controlsList', 'nodownload noplaybackrate noremoteplayback');
    v.disablePictureInPicture = true;
    v.setAttribute('disableRemotePlayback', '');
    if (it.poster) v.poster = new URL(it.poster, base).href;
    // Two sources, VP9 first. H.264 is absent from Chromium builds without the
    // licensed decoder — the same gap that forced the stems to MP3 — so the
    // browser picks whichever it can actually decode.
    for (const s of (it.sources || [{ src: it.src }])) {
      const src = document.createElement('source');
      src.src = new URL(s.src, base).href;
      if (s.type) src.type = s.type;
      v.appendChild(src);
    }
    stage.appendChild(v);
    v.play().catch(() => {});
    return () => { v.pause(); v.innerHTML = ''; v.load(); };
  }

  // ── the wall ─────────────────────────────────────────────────────────────
  function mountWall(it) {
    const total = it.boards.reduce((n, b) => n + b.w, 0);

    const zoomBtn = document.createElement('button');
    zoomBtn.type = 'button';
    zoomBtn.className = 'arc-tool';
    barTools.appendChild(zoomBtn);

    const wrap = document.createElement('div');
    wrap.className = 'wall';
    const strip = document.createElement('div');
    strip.className = 'wall-strip';

    for (const b of it.boards) {
      const grp = document.createElement('div');
      grp.className = 'wall-board';
      grp.dataset.label = b.label;
      for (const s of b.segments) {
        const img = document.createElement('img');
        img.src = new URL(s.src, base).href;
        img.alt = `Board ${b.label}`;
        img.decoding = 'async';
        img.draggable = false;
        img.style.aspectRatio = `${s.w} / ${s.h}`;
        grp.appendChild(img);
      }
      strip.appendChild(grp);
    }
    wrap.appendChild(strip);

    // scrubber — three proportional blocks with a viewport indicator
    const scrub = document.createElement('div');
    scrub.className = 'wall-scrub';
    const marks = it.boards.map(b => {
      const m = document.createElement('button');
      m.type = 'button';
      m.className = 'wall-mark';
      m.style.flex = String(b.w);
      m.innerHTML = `<span>${b.label}</span>`;
      m.addEventListener('click', () => {
        const before = it.boards.slice(0, it.boards.indexOf(b)).reduce((n, x) => n + x.w, 0);
        wrap.scrollTo({ left: (before / total) * strip.scrollWidth, behavior: 'smooth' });
      });
      scrub.appendChild(m);
      return m;
    });
    const eye = document.createElement('div');
    eye.className = 'wall-eye';
    scrub.appendChild(eye);

    stage.append(wrap, scrub);

    // zoom: fit the viewport height, or 2.5× that for reading board text
    let zoomed = false;
    const applyZoom = () => {
      strip.style.height = zoomed ? '250%' : '100%';
      zoomBtn.textContent = zoomed ? 'Fit to screen' : 'Zoom in';
      zoomBtn.setAttribute('aria-pressed', String(zoomed));
    };
    zoomBtn.addEventListener('click', () => {
      const mid = (wrap.scrollLeft + wrap.clientWidth / 2) / strip.scrollWidth || 0;
      zoomed = !zoomed;
      applyZoom();
      requestAnimationFrame(() => {
        wrap.scrollLeft = mid * strip.scrollWidth - wrap.clientWidth / 2;
        sync();
      });
    });
    applyZoom();

    const sync = () => {
      const frac = wrap.scrollWidth > wrap.clientWidth
        ? wrap.scrollLeft / (wrap.scrollWidth - wrap.clientWidth) : 0;
      const vis = Math.min(1, wrap.clientWidth / wrap.scrollWidth);
      eye.style.width = (vis * 100) + '%';
      eye.style.left  = (frac * (100 - vis * 100)) + '%';
      let acc = 0, active = 0;
      const centre = (wrap.scrollLeft + wrap.clientWidth / 2) / strip.scrollWidth * total;
      it.boards.forEach((b, i) => { if (centre >= acc) active = i; acc += b.w; });
      marks.forEach((m, i) => m.toggleAttribute('data-on', i === active));
    };
    wrap.addEventListener('scroll', sync, { passive: true });

    // a vertical wheel should walk the wall, not do nothing
    const onWheel = e => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      wrap.scrollLeft += e.deltaY;
    };
    wrap.addEventListener('wheel', onWheel, { passive: false });

    // drag to pan
    let down = false, sx = 0, sl = 0;
    const pd = e => { down = true; sx = e.clientX; sl = wrap.scrollLeft; wrap.setPointerCapture(e.pointerId); wrap.dataset.drag = 'true'; };
    const pm = e => { if (down) wrap.scrollLeft = sl - (e.clientX - sx); };
    const pu = () => { down = false; delete wrap.dataset.drag; };
    wrap.addEventListener('pointerdown', pd);
    wrap.addEventListener('pointermove', pm);
    wrap.addEventListener('pointerup', pu);
    wrap.addEventListener('pointercancel', pu);

    requestAnimationFrame(sync);
    return () => wrap.removeEventListener('wheel', onWheel);
  }

  ov.querySelector('.arc-close').addEventListener('click', close);
  ov.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    if (!ov.hidden && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const w = stage.querySelector('.wall');
      if (w) { e.preventDefault(); w.scrollLeft += (e.key === 'ArrowRight' ? 1 : -1) * 240; }
    }
  });

  return {
    el,
    show() { el.hidden = false; },
    hide() { el.hidden = true; if (!ov.hidden) close(); },
    get open() { return !ov.hidden; },
    close
  };
}
