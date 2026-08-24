/* Sliding description panel. Closed by default: the argument is the image and
   the mix, and text permanently in shot competes with both. */
export function createReader(root, credit) {
  const el = document.createElement('aside');
  el.className = 'reader';
  el.setAttribute('data-open', 'false');
  el.setAttribute('aria-label', 'Description');
  el.inert = true;
  el.innerHTML = `
    <button class="close" type="button">Close ESC</button>
    <p class="meta"></p><h3></h3><div class="body"></div>
    <p class="credit"></p>`;
  root.appendChild(el);

  const meta = el.querySelector('.meta'), h3 = el.querySelector('h3');
  const body = el.querySelector('.body'), cred = el.querySelector('.credit');
  cred.textContent = credit ? `${credit.track} — ${credit.artist}. ${credit.note || ''}` : '';

  let opener = null;
  const api = {
    el,
    get open() { return el.getAttribute('data-open') === 'true'; },
    set(node, i, total) {
      meta.textContent = node.hero ? 'Full panel' : `Sub-component ${i} of ${total}`;
      h3.textContent = node.label;
      body.innerHTML = '';
      for (const para of String(node.body || '').split('\n\n')) {
        if (!para.trim()) continue;
        const p = document.createElement('p');
        p.textContent = para.trim();
        body.appendChild(p);
      }
      el.scrollTop = 0;
    },
    show(from) {
      opener = from || null;
      el.setAttribute('data-open', 'true');
      el.inert = false;
      document.body.setAttribute('data-reader', 'true');
      el.querySelector('.close').focus();
    },
    hide() {
      el.setAttribute('data-open', 'false');
      el.inert = true;
      document.body.setAttribute('data-reader', 'false');
      if (opener) opener.focus();
    },
    toggle(from) { api.open ? api.hide() : api.show(from); }
  };
  el.querySelector('.close').addEventListener('click', () => api.hide());
  return api;
}
