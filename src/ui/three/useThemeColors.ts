import { useEffect, useState } from 'react';

/** Design tokens the scene uses. three.js cannot read CSS variables, so they are resolved here. */
const TOKENS = {
  surface: '--color-surface',
  text: '--color-text',
  terrain: '--color-terrain',
  terrainFill: '--color-terrain-fill',
  pipe: '--color-pipe',
  water: '--color-water',
  hgl: '--color-hgl',
  reservoir: '--color-reservoir',
  pump: '--color-accent',
  selected: '--color-primary',
  pressureLow: '--color-pressure-low',
  pressureOk: '--color-pressure-ok',
  pressureHigh: '--color-pressure-high',
  velocityLow: '--color-velocity-low',
  velocityOk: '--color-velocity-ok',
  velocityHigh: '--color-velocity-high',
} as const;

export type SceneColors = Record<keyof typeof TOKENS, string>;

/** Only used when a token is missing (stylesheet not loaded), so three.js gets a valid colour. */
const MISSING = '#808080';

function readColors(): SceneColors {
  const style = getComputedStyle(document.documentElement);
  const colors = {} as SceneColors;
  for (const key of Object.keys(TOKENS) as (keyof typeof TOKENS)[]) {
    colors[key] = style.getPropertyValue(TOKENS[key]).trim() || MISSING;
  }
  return colors;
}

function sameColors(a: SceneColors, b: SceneColors): boolean {
  return (Object.keys(TOKENS) as (keyof typeof TOKENS)[]).every((key) => a[key] === b[key]);
}

/**
 * Colours of the current theme, read from the CSS tokens. They are read again when the theme
 * changes: `data-theme` on <html> (manual choice) or the system colour scheme.
 */
export function useThemeColors(): SceneColors {
  const [colors, setColors] = useState(readColors);

  useEffect(() => {
    const update = () =>
      setColors((previous) => {
        const next = readColors();
        return sameColors(previous, next) ? previous : next;
      });
    update();

    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    const media =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;
    media?.addEventListener('change', update);
    return () => {
      observer.disconnect();
      media?.removeEventListener('change', update);
    };
  }, []);

  return colors;
}
