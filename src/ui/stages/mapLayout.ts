/** Where a neighbourhood and its label sit, in map units. */
export interface Site {
  /** Centre of the scenery. */
  x: number;
  y: number;
  /** CSS box of the label, in percentages of the map. */
  label: { left: string; width: string; top?: string; bottom?: string };
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

/** The road passes below the houses of each neighbourhood. */
export const ROAD_DY = 46;

/** One row of the phone map: the drawing of a neighbourhood, above the card of its stage. */
export interface Strip {
  /** Centre of the scenery. */
  x: number;
  y: number;
  /** Road from the top edge, where it comes out from under the previous card; null on the first. */
  roadIn: string | null;
  /** Road to the bottom edge, where it goes under the card of this stage; null on the last. */
  roadOut: string | null;
}

export interface StripLayout {
  /** Size of every strip, in map units. */
  width: number;
  height: number;
  strips: Strip[];
}

/**
 * Phone: one strip per stage, alternating sides. The cards sit between the strips in normal
 * flow, so their height is free (long titles, summaries, large text). The road leaves a strip
 * straight down below its waypoint and enters the next one at the same x, so it reads as one
 * road passing under the cards.
 */
export function stripLayout(count: number): StripLayout {
  const width = 360;
  const height = 140;
  const y = 62;
  const node = y + ROAD_DY;
  const strips: Strip[] = [];
  for (let i = 0; i < count; i++) {
    const x = i % 2 === 0 ? 98 : width - 98;
    const from = width - x;
    strips.push({
      x,
      y,
      roadIn: i > 0 ? `M${from} 0C${from} 70 ${width / 2} ${node} ${x} ${node}` : null,
      roadOut: i < count - 1 ? `M${x} ${node}V${height}` : null,
    });
  }
  return { width, height, strips };
}

/** Smooth road segment between two neighbourhoods: it leaves and arrives horizontally. */
export function segment(from: Site, to: Site): string {
  const y0 = from.y + ROAD_DY;
  const y1 = to.y + ROAD_DY;
  const mid = (from.x + to.x) / 2;
  return `M${from.x} ${y0}C${mid} ${y0} ${mid} ${y1} ${to.x} ${y1}`;
}
