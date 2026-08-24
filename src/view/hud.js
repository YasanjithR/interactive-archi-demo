/* Meter + index. The meter reads the real gain nodes, so it is honest about
   what the graph is doing mid-glide. It is also the accessibility fallback:
   with the sound off, this is what still explains the mechanic. */
export function createHud(root, channels, nodes, onJump) {
  const el = document.createElement('div');
  el.className = 'hud';

  const meter = document.createElement('div');
  meter.className = 'meter';
  const rows = {};
  for (const c of channels) {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<span class="nm">${c.label}</span><div class="track"><div class="fill"></div></div>`;
    meter.appendChild(row);
    rows[c.id] = { row, fill: row.querySelector('.fill') };
  }

  const index = document.createElement('nav');
  index.className = 'index';
  index.setAttribute('aria-label', 'Sub-components');
  const btns = nodes.map((n, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<span class="i">${n.hero ? '—' : String(i).padStart(2, '0')}</span><span>${n.label}</span>`;
    b.addEventListener('click', () => onJump(i));
    index.appendChild(b);
    return b;
  });

  el.append(meter, index);
  root.appendChild(el);

  return {
    setActive(i, node) {
      btns.forEach((b, k) => b.setAttribute('aria-current', String(k === i)));
      const front = new Set([].concat(node.focus || []));
      for (const [id, r] of Object.entries(rows)) r.row.toggleAttribute('data-front', node.hero || front.has(id));
    },
    setLevels(levels) {
      for (const [id, r] of Object.entries(rows)) {
        const v = Math.max(0, Math.min(1, levels[id] ?? 0));
        r.fill.style.width = (v * 100).toFixed(1) + '%';
      }
    }
  };
}
