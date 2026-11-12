import gsap from 'gsap';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import type { Theme } from './types';

gsap.registerPlugin(MorphSVGPlugin);

const SUN = 'M12 7a5 5 0 1 1 0 10a5 5 0 1 1 0-10z';
const MOON = 'M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a7.2 7.2 0 0 0 9.7 9.7z';

interface IconPose {
  body: string;
  rays: { scale: number; opacity: number; rotation: number };
  icon: number;
}

const POSE: Record<Theme, IconPose> = {
  light: { body: SUN, rays: { scale: 1, opacity: 1, rotation: 0 }, icon: 0 },
  dark: { body: MOON, rays: { scale: 0.2, opacity: 0, rotation: -60 }, icon: -25 },
};

export interface MorphOptions {
  duration: number;
  ease: string;
  timeScale: number;
}

export class ThemeIcon {
  private readonly icon: SVGSVGElement | null;
  private readonly body: SVGPathElement | null;
  private readonly rays: SVGLineElement[];
  private timeline: gsap.core.Timeline | null = null;

  constructor(button: HTMLElement) {
    this.icon = button.querySelector('svg');
    this.body = button.querySelector('.theme-toggle__body');
    this.rays = Array.from(button.querySelectorAll<SVGLineElement>('.theme-toggle__rays line'));
  }

  kill(): void {
    this.timeline?.kill();
    this.timeline = null;
  }

  set(theme: Theme): void {
    this.timeline?.kill();
    this.timeline = null;
    const pose = POSE[theme];
    if (this.body) gsap.set(this.body, { morphSVG: pose.body });
    gsap.set(this.rays, { ...pose.rays, svgOrigin: '12 12' });
    if (this.icon) gsap.set(this.icon, { rotation: pose.icon, transformOrigin: '50% 50%' });
  }

  morphTo(theme: Theme, opts: MorphOptions): void {
    this.timeline?.kill();
    const pose = POSE[theme];
    const tl = gsap.timeline({ defaults: { duration: opts.duration, ease: opts.ease } });

    if (this.body) {
      tl.to(this.body, { morphSVG: { shape: pose.body, shapeIndex: 'auto' } }, 0);
    }
    if (this.rays.length > 0) {
      tl.to(this.rays, { ...pose.rays, svgOrigin: '12 12', stagger: opts.duration * 0.035 }, 0);
    }
    if (this.icon) {
      tl.to(this.icon, { rotation: pose.icon, transformOrigin: '50% 50%' }, 0);
    }

    tl.timeScale(opts.timeScale);
    this.timeline = tl;
  }
}
