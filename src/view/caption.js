export function createCaption(root, channels) {
  const el = document.createElement('div');
  el.className = 'caption';
  el.innerHTML = '<span class="num"></span><h2></h2><p class="stem"></p>';
  root.appendChild(el);
  const num = el.querySelector('.num'), h2 = el.querySelector('h2'), stem = el.querySelector('.stem');
  return {
    set(node, i, total) {
      num.textContent = node.hero ? 'FULL PANEL' : `${String(i).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
      h2.textContent = node.label;
      if (node.hero) { stem.textContent = 'all stems at full'; return; }
      const front = [].concat(node.focus || []).map(id => (channels.find(c => c.id === id) || {}).label || id);
      // A section can deliberately have nothing in front — Common Ground's
      // minor-key part holds all three elements at half. `note` covers that
      // case so the line reads as intent rather than as a missing value.
      if (front.length) stem.innerHTML = `driven by <b>${front.join(' + ')}</b>`;
      else stem.textContent = node.note || '';
    }
  };
}
