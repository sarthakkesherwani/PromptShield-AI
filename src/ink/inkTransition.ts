import { flushSync } from 'react-dom';
import gsap from 'gsap';
import { captureViewport, renderScale, warmCaptureResources } from './capture';
import { inkParams } from './params';
import { InkRenderer, type InkFrame, type Snapshot } from './renderer';
import { ThemeIcon } from './themeIcon';
import { otherTheme, type Theme } from './types';

export interface Point {
  x: number;
  y: number;
}

const EASE = 'power2.out';
const FADE_OUT = 0.22;
const CSS_FADE_S = 0.38;

export const SPREAD = { growth: 0.85, cleanupFrom: 0.36, cleanupReach: 0.42, cleanupPow: 2.3 };

const reducedMotion =
  typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

type ActiveFrame = Omit<InkFrame, 'progress' | 'radius' | 'time' | 'cleanup'>;

function viewportKey(theme: Theme): string {
  return `${theme}:${document.documentElement.clientWidth}x${window.innerHeight}:${Math.round(window.scrollX)},${Math.round(window.scrollY)}`;
}

/**
 * WebGL2 Ink-Bleed Theme Transition with 0ms click response:
 * - Pre-captures ONLY the current (`from`) viewport silently when idle & on hover.
 * - On toggle click: locks screen with `from` (`alpha=1`), flips the live DOM underneath
 *   via `flushSync`, and immediately spreads the real WebGL2 `INK_FRAG` organic tendril
 *   cutout (`alpha=0`) revealing the live new theme underneath — zero second capture needed!
 */
export class InkTransition {
  private readonly renderer: InkRenderer | null;
  private toggleButton: HTMLButtonElement | null = null;
  private icon: ThemeIcon | null = null;
  private readonly state = { progress: 0, time: 0 };
  private tween: gsap.core.Tween | null = null;
  private fade: gsap.core.Tween | null = null;
  private frame: ActiveFrame | null = null;
  private cssFadeTimer = 0;
  private preCaptureTimer = 0;
  private busy = false;

  private cachedFrom: { key: string; snap: Snapshot; uploaded: boolean } | null = null;
  private warmingPromise: Promise<void> | null = null;

  constructor(canvas: HTMLCanvasElement, toggleButton: HTMLButtonElement | null, initialTheme: Theme) {
    this.toggleButton = toggleButton;
    if (toggleButton) {
      this.icon = new ThemeIcon(toggleButton);
      this.icon.set(initialTheme);
    }

    this.renderer = InkRenderer.create(canvas);
    if (!this.renderer) return;

    this.renderer.resize(renderScale());
    this.renderer.watchContext(
      () => this.cancel(),
      () => {},
    );

    const invalidate = () => {
      this.cachedFrom = null;
      const current: Theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      this.schedulePreCapture(current, 140);
    };

    window.addEventListener('resize', () => {
      this.renderer?.resize(renderScale());
      if (this.frame) this.draw();
      invalidate();
    });
    window.addEventListener('scroll', invalidate, { passive: true });

    warmCaptureResources();
    gsap.ticker.lagSmoothing(0);
    this.schedulePreCapture(initialTheme, 150);
  }

  attachToggle(button: HTMLButtonElement | null, theme: Theme): void {
    this.toggleButton = button;
    if (button) {
      this.icon = new ThemeIcon(button);
      if (!this.frame) this.icon.set(theme);
    } else {
      this.icon = null;
    }
  }

  warm(theme: Theme): void {
    const renderer = this.renderer;
    if (!renderer || renderer.isLost || reducedMotion?.matches || this.busy || this.frame) return;
    const key = viewportKey(theme);
    if (this.cachedFrom?.key === key || this.warmingPromise) return;

    const scale = renderScale();
    this.warmingPromise = captureViewport(theme, scale, renderer.maxTextureSize)
      .then((snap) => {
        if (!this.busy && !this.frame && viewportKey(theme) === key) {
          renderer.resize(scale);
          renderer.upload(snap);
          this.cachedFrom = { key, snap, uploaded: true };
        }
      })
      .catch(() => {})
      .finally(() => {
        this.warmingPromise = null;
      });
  }

  invalidateCache(theme?: Theme): void {
    this.cachedFrom = null;
    if (theme) this.schedulePreCapture(theme, 250);
  }

  private schedulePreCapture(theme: Theme, delayMs: number): void {
    window.clearTimeout(this.preCaptureTimer);
    this.preCaptureTimer = window.setTimeout(() => this.warm(theme), delayMs);
  }

  async toggle(
    currentTheme: Theme,
    applyThemeDom: (next: Theme) => void,
    point?: Point
  ): Promise<void> {
    if (this.busy) return;
    const to = otherTheme(currentTheme);
    const renderer = this.renderer;

    if (!renderer || renderer.isLost || reducedMotion?.matches) {
      this.cancel();
      this.crossFade(to, applyThemeDom);
      return;
    }

    // If clicked rapidly while mid-transition, settle immediately and crossfade cleanly
    if (this.frame) {
      this.cancel();
      this.crossFade(to, applyThemeDom);
      this.schedulePreCapture(to, 450);
      return;
    }

    this.busy = true;
    // Start Sun <-> Moon icon morph immediately on frame 0
    this.icon?.morphTo(to, {
      duration: inkParams.duration,
      ease: EASE,
      timeScale: inkParams.timeScale,
    });

    try {
      const scale = renderScale();
      const expectedKey = viewportKey(currentTheme);

      if (this.warmingPromise) await this.warmingPromise;

      if (this.cachedFrom?.key === expectedKey) {
        if (!this.cachedFrom.uploaded) {
          renderer.resize(scale);
          renderer.upload(this.cachedFrom.snap);
        }
      } else {
        const snap = await captureViewport(currentTheme, scale, renderer.maxTextureSize);
        renderer.resize(scale);
        renderer.upload(snap);
      }

      const center = point ?? this.toggleCenter();
      const maxDist = farthestCorner(center);
      const seed = randomSeed();

      this.frame = { from: currentTheme, to, center, maxDist, seed };
      this.state.progress = 0;
      this.state.time = 0;

      // Render progress=0 (`from` opaque everywhere) BEFORE flipping live DOM
      this.draw();
      gsap.set(renderer.canvas, { opacity: 1 });
      renderer.canvas.classList.add('is-active');

      // Flip live DOM underneath synchronously — zero `to` screenshot needed!
      flushSync(() => {
        applyThemeDom(to);
      });

      this.busy = false;
      this.cachedFrom = null;

      this.tween = gsap.to(this.state, {
        progress: 1,
        duration: inkParams.duration,
        ease: EASE,
        onUpdate: () => {
          this.state.time = this.tween?.time() ?? 0;
          this.draw();
        },
        onComplete: () => this.finish(to),
      });
      this.tween.timeScale(inkParams.timeScale);
    } catch (err) {
      console.error('[ink] WebGL transition fallback to CSS fade:', err);
      this.busy = false;
      this.cancel();
      this.crossFade(to, applyThemeDom);
      this.schedulePreCapture(to, 450);
    }
  }

  destroy(): void {
    this.cancel();
    this.icon?.kill();
    window.clearTimeout(this.cssFadeTimer);
    window.clearTimeout(this.preCaptureTimer);
  }

  private currentFrame(): InkFrame | null {
    if (!this.frame) return null;
    const { progress, time } = this.state;
    const { maxDist } = this.frame;
    const linear = Math.min(1, time / inkParams.duration);
    const ramp = Math.max(0, (linear - SPREAD.cleanupFrom) / (1 - SPREAD.cleanupFrom));
    const cleanup =
      ramp ** SPREAD.cleanupPow * maxDist * SPREAD.cleanupReach +
      Math.max(0, (linear - 0.97) / 0.03) * maxDist;
    return { ...this.frame, progress, time, radius: progress * maxDist * SPREAD.growth, cleanup };
  }

  private draw(): void {
    const frame = this.currentFrame();
    if (this.renderer && frame) this.renderer.draw(frame);
  }

  private finish(revealedTheme: Theme): void {
    const canvas = this.renderer?.canvas;
    this.tween = null;
    if (!canvas) return;
    this.fade = gsap
      .to(canvas, {
        opacity: 0,
        duration: FADE_OUT,
        ease: 'power1.out',
        onComplete: () => {
          this.hide();
          // Immediately warm the newly revealed theme in the background for 0ms next toggle
          this.schedulePreCapture(revealedTheme, 10);
        },
      })
      .timeScale(inkParams.timeScale);
  }

  private hide(): void {
    this.fade = null;
    this.frame = null;
    this.renderer?.canvas.classList.remove('is-active');
  }

  private cancel(): void {
    if (!this.frame) return;
    this.tween?.kill();
    this.fade?.kill();
    this.tween = null;
    this.hide();
  }

  private crossFade(to: Theme, applyThemeDom: (next: Theme) => void): void {
    const root = document.documentElement;
    const motion = !(reducedMotion?.matches ?? false);
    root.classList.add('theme-fade');
    root.style.setProperty('--theme-fade', `${CSS_FADE_S}s`);
    applyThemeDom(to);
    if (motion) {
      this.icon?.morphTo(to, { duration: CSS_FADE_S * 1.4, ease: 'power2.inOut', timeScale: 1 });
    } else {
      this.icon?.set(to);
    }
    window.clearTimeout(this.cssFadeTimer);
    this.cssFadeTimer = window.setTimeout(() => {
      root.classList.remove('theme-fade');
    }, CSS_FADE_S * 1000 + 50);
  }

  private toggleCenter(): Point {
    const r = this.toggleButton?.getBoundingClientRect();
    if (!r) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
}

function farthestCorner(p: Point): number {
  const w = document.documentElement.clientWidth;
  const h = document.documentElement.clientHeight;
  return (
    Math.max(
      Math.hypot(p.x, p.y),
      Math.hypot(w - p.x, p.y),
      Math.hypot(p.x, h - p.y),
      Math.hypot(w - p.x, h - p.y)
    ) + 4
  );
}

function randomSeed(): InkFrame['seed'] {
  return {
    x: Math.random() * 64 - 32,
    y: Math.random() * 64 - 32,
    angle: Math.random() * Math.PI * 2,
  };
}
