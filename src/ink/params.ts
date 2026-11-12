import type { Theme } from './types';

export interface InkParams {
  duration: number;
  tendril: number;
  noiseScale: number;
  softness: number;
  drift: number;
  timeScale: number;
}

export const inkParams: InkParams = {
  duration: 1.15,
  tendril: 1.05,
  noiseScale: 0.92,
  softness: 3.2,
  drift: 0.75,
  timeScale: 1,
};

/** Pigment colour pooled at the frontier, keyed by the theme being revealed. */
export const RIM_COLOR: Record<Theme, [number, number, number]> = {
  dark: [0.02, 0.0, 0.01], // dense ink rim when revealing dark mode
  light: [1.0, 0.996, 0.99], // bright bleach rim when revealing light mode
};
