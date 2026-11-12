/** Where a neighbourhood and its label sit, in map units. */
export interface Site {
  /** Centre of the scenery. */
  x: number;
  y: number;
  /** CSS box of the label, in percentages of the map. */
  label: { left: string; width: string; top?: string; bottom?: string; transform?: string };
}

export interface MapLayout {
  width: number;
  height: number;
  sites: Site[];
}

const percent = (value: number, of: number) => `${((value / of) * 100).toFixed(2)}%`;

/**
 * Desktop: the road runs left to right and zigzags gently; labels alternate above and below so
 * each one can be wider than its neighbourhood.
 */
export function wideLayout(count: number): MapLayout {
  const width = 1000;
  const height = 500;
  const sites: Site[] = [];
  for (let i = 0; i < count; i++) {
    const x = count > 1 ? 160 + (680 * i) / (count - 1) : width / 2;
    const up = i % 2 === 0;
    sites.push({
      x,
      y: up ? 205 : 290,
      label: {
        left: percent(x - 150, width),
        width: '30%',
        ...(up ? { bottom: percent(height - 136, height) } : { top: percent(362, height) }),
      },
    });
  }
  return { width, height, sites };
}

/** Phone: one neighbourhood per row, alternating sides, with the label on the other side. */
export function tallLayout(count: number): MapLayout {
  const width = 360;
  const row = 180;
  const height = count * row;
  const sites: Site[] = [];
  for (let i = 0; i < count; i++) {
    const left = i % 2 === 0;
    const y = row * i + row / 2 - 6;
    sites.push({
      x: left ? 98 : width - 98,
      y,
      label: {
        left: left ? '53%' : '2%',
        width: '45%',
        top: percent(y + 6, height),
        transform: 'translateY(-50%)',
      },
    });
  }
  return { width, height, sites };
}

/** The road passes below the houses of each neighbourhood. */
export const ROAD_DY = 46;

/** Smooth road segment between two neighbourhoods: it leaves and arrives horizontally. */
export function segment(from: Site, to: Site): string {
  const y0 = from.y + ROAD_DY;
  const y1 = to.y + ROAD_DY;
  const mid = (from.x + to.x) / 2;
  return `M${from.x} ${y0}C${mid} ${y0} ${mid} ${y1} ${to.x} ${y1}`;
}
