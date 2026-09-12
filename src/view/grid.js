/* Panel chooser. Sits between the gate and the stepped experience.

   A scrollable page rather than a fixed stage — this is the one screen where
   the reader is comparing rather than looking, so it gets the browser's own
   scrolling back. */
export function createGrid(root, index, base, onOpen, onIntent = () => {}) {
  const el = document.createElement('div');
  el.className = 'grid-screen';
  el.hidden = true;

  const head = document.createElement('header');
  head.className = 'grid-head';
  head.innerHTML = `<h1>${index.title}</h1><p>${index.subtitle}</p>`;

  const list = document.createElement('div');
  list.className = 'grid';

  for (const p of index.panels) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'card';
    card.setAttribute('aria-label', `${p.title} — ${p.kicker}`);
    const img = new URL(p.cover, base).href;
    card.innerHTML = `
      <span class="thumb"><img src="${img}" alt="" loading="lazy" decoding="async"></span>
      <span class="meta">
        <span class="kick">${p.kicker || ''}</span>
        <span class="name">${p.title}</span>
        <span class="blurb">${p.blurb || ''}</span>
        <span class="parts">${p.parts} sub-components</span>
      </span>`;
    card.addEventListener('click', () => onOpen(p.id));
    // Hovering or tabbing to a card is a strong signal. Warm the network cache
    // now so the click has less to wait for.
    let warmed = false;
    const warm = () => { if (!warmed) { warmed = true; onIntent(p.id); } };
    card.addEventListener('pointerenter', warm);
    card.addEventListener('focus', warm);
    list.appendChild(card);
  }

  el.append(head, list);
  root.appendChild(el);

  return {
    el,
    show() { el.hidden = false; document.body.dataset.screen = 'grid'; el.scrollTop = 0; },
    hide() { el.hidden = true; }
  };
}
