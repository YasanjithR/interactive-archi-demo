/* Browsers refuse audio without a gesture, so the click is mandatory.
   Make it the first beat of the piece rather than an apology. */
export function createGate(root, panel, onEnter) {
  const el = document.createElement('div');
  el.className = 'gate';
  const g = panel.gate || {};
  el.innerHTML = `
    <div class="inner">
      <p class="kicker">${g.kicker || panel.kicker || ''}</p>
      <h1>${g.title || panel.title}</h1>
      <button class="enter" type="button">Enter</button>
      <div class="bar"><i></i></div>
      <p class="hint">Headphones recommended · sound starts on entry</p>
      <p class="err" hidden></p>
    </div>`;
  root.appendChild(el);

  const btn = el.querySelector('.enter');
  const fill = el.querySelector('.bar i');
  const err = el.querySelector('.err');

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Loading';
    err.hidden = true;
    try {
      await onEnter(p => { fill.style.width = (p * 100).toFixed(0) + '%'; });
    } catch (e) {
      btn.disabled = false;
      btn.textContent = 'Continue without sound';
      err.hidden = false;
      err.textContent = String(e && e.message || e);
      throw e;
    }
  });

  return {
    focus() { btn.focus(); },
    dismiss() {
      el.classList.add('leaving');
      setTimeout(() => { el.hidden = true; }, 620);
    }
  };
}
