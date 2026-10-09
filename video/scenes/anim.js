/* global window, document, URLSearchParams */
// Card animation as a pure function of time (spec §5.3): build.ts calls seek(t, d) and screenshots each frame.
const scene = new URLSearchParams(window.location.search).get('scene');
document.getElementById(scene).hidden = false;

const clamp = (x) => Math.min(Math.max(x, 0), 1);
const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);
const RISE = 0.6; // seconds an item takes to appear or leave

window.hooks = window.hooks || {};
window.setData = (data) => window.hooks[scene]?.setup?.(data);
window.seek = (t, d) => {
  for (const el of document.querySelectorAll(`#${scene} [data-at]`)) {
    const at = Number(el.dataset.at) * d;
    const out = el.dataset.out === undefined ? Infinity : Number(el.dataset.out) * d;
    const k = ease((t - at) / RISE) * (1 - ease((t - out) / RISE));
    el.style.opacity = String(k);
    el.style.transform = `translateY(${(1 - k) * 18}px)`;
  }
  window.hooks[scene]?.seek?.(t, d);
};
