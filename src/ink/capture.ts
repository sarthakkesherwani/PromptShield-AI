import type { Snapshot } from './renderer';
import type { Theme } from './types';

const BACKGROUND: Record<Theme, string> = {
  light: '#ffffff',
  dark: '#0a0a0a',
};

export function renderScale(): number {
  return Math.min(window.devicePixelRatio || 1, 1.25);
}

let modPromise: Promise<typeof import('modern-screenshot')> | null = null;
let cachedFontCss: string | null = null;
let fontPromise: Promise<string> | null = null;

function getMod() {
  if (!modPromise) modPromise = import('modern-screenshot');
  return modPromise;
}

function getFontCss(): Promise<string> {
  if (cachedFontCss !== null) return Promise.resolve(cachedFontCss);
  if (!fontPromise) {
    fontPromise = fetch('/fonts/absans-regular.woff2')
      .then((res) => (res.ok ? res.blob() : null))
      .then(
        (blob) =>
          new Promise<string>((resolve) => {
            if (!blob) {
              cachedFontCss = '';
              resolve('');
              return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
              const dataUrl = typeof reader.result === 'string' ? reader.result : '';
              cachedFontCss = dataUrl
                ? `@font-face { font-family: "Absans"; src: url("${dataUrl}") format("woff2"); font-weight: 400; font-style: normal; }`
                : '';
              resolve(cachedFontCss);
            };
            reader.onerror = () => {
              cachedFontCss = '';
              resolve('');
            };
            reader.readAsDataURL(blob);
          })
      )
      .catch(() => {
        cachedFontCss = '';
        return '';
      });
  }
  return fontPromise;
}

export function warmCaptureResources(): void {
  void getMod();
  void getFontCss();
}

export async function captureViewport(
  theme: Theme,
  scale: number,
  maxTextureSize: number
): Promise<Snapshot> {
  const t0 = performance.now();
  const width = document.documentElement.clientWidth;
  const height = window.innerHeight;
  const safeScale = Math.min(scale, maxTextureSize / width, maxTextureSize / height);
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  const [{ domToCanvas }, fontCss] = await Promise.all([getMod(), getFontCss()]);

  const canvas = await domToCanvas(document.documentElement, {
    width,
    height,
    scale: safeScale,
    backgroundColor: BACKGROUND[theme],
    font: fontCss ? { cssText: fontCss } : false,
    features: {
      restoreScrollPosition: false,
      copyScrollbar: false,
    },
    filter: (node) => {
      if (!(node instanceof Element)) return true;
      if (node.id === 'ink-bleed-canvas') return false;
      const tag = node.tagName;
      // Skip completely offscreen sections, footer, table rows, or offscreen marquee cards
      if (tag === 'SECTION' || tag === 'FOOTER' || tag === 'TR') {
        const rect = node.getBoundingClientRect();
        if (rect.bottom < -40 || rect.top > height + 40) return false;
      }
      if (node.classList.contains('min-w-[280px]')) {
        const rect = node.getBoundingClientRect();
        if (rect.right < -40 || rect.left > width + 40) return false;
      }
      return true;
    },
    onCloneEachNode: (cloned) => {
      if (!(cloned instanceof HTMLElement)) return;
      if (cloned.tagName === 'BODY' && (scrollY > 0 || scrollX > 0)) {
        cloned.style.marginTop = `${-scrollY}px`;
        cloned.style.marginLeft = `${-scrollX}px`;
      }
      if (cloned.tagName === 'NAV' && scrollY > 0) {
        cloned.style.position = 'fixed';
        cloned.style.top = '0px';
        cloned.style.left = '0px';
        cloned.style.right = '0px';
        cloned.style.width = '100%';
      }
    },
  });

  return {
    theme,
    canvas,
    scale: safeScale,
    ms: performance.now() - t0,
  };
}
