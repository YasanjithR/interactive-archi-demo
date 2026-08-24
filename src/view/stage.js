/* Every part image, stacked, cross-faded by opacity.

   Two decisions specific to this panel: the four renders share one camera, so
   they must register exactly — no scale or pan on transition, or the build-up
   reads as four separate pictures instead of one space assembling itself. And
   they are symmetric one-point perspectives, so `contain` rather than `cover`:
   cropping the sides would destroy the composition. */
export function createStage(root, nodes, base) {
  const el = document.createElement('div');
  el.className = 'stage';
  const imgs = nodes.map((n, i) => {
    const img = document.createElement('img');
    img.src = new URL(n.image, base).href;
    img.alt = n.label;
    img.decoding = 'async';
    if (i === 0) img.fetchPriority = 'high';
    el.appendChild(img);
    return img;
  });
  root.appendChild(el);
  return {
    setActive(i) { imgs.forEach((im, k) => im.toggleAttribute('data-active', k === i)); },
    failures() { return imgs.filter(im => im.complete && im.naturalWidth === 0).length; }
  };
}
