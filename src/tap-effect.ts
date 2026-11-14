/** Lightweight pointer feedback, isolated from page controls. */
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const layer = document.createElement('div');
layer.className = 'tap-effects';
layer.setAttribute('aria-hidden', 'true');
document.body.appendChild(layer);

document.addEventListener('pointerdown', (event: PointerEvent) => {
  if (!event.isPrimary || event.button !== 0 || reducedMotion.matches) return;
  if (event.target instanceof Element && event.target.closest(':disabled, [aria-disabled="true"]')) return;
  // Keep rapid repeated taps bounded, and never intercept input or scrolling.
  while (layer.childElementCount >= 12) layer.firstElementChild?.remove();
  const ripple = document.createElement('span');
  ripple.className = 'tap-ripple';
  ripple.style.left = `${event.clientX}px`;
  ripple.style.top = `${event.clientY}px`;
  layer.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  window.setTimeout(() => ripple.remove(), 650);
}, { passive: true });
