/**
 * Label placement shared by the schematic and the town view. Pure functions in screen
 * coordinates (px). Each label offers several options (positions and amounts of text); the
 * placer keeps the options that touch nothing else and drops text from the least important
 * labels first.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A line with thickness (a pipe) that labels must not cover. */
export interface ThickSegment {
  a: { x: number; y: number };
  b: { x: number; y: number };
  half: number;
}

export interface LabelOption<T> {
  rect: Rect;
  /** Amount of text: options with more detail are preferred when they fit. */
  detail: number;
  /** The option is used only while it covers at most this many soft rects. Default: any. */
  maxSoft?: number;
  data: T;
}

export interface LabelRequest<T> {
  id: string;
  /** Higher places first and keeps its text longer. */
  priority: number;
  /** In order of preference within the same detail. */
  options: LabelOption<T>[];
  /**
   * Last resort, in order of preference: places further from the element (drawn with a leader
   * line) for the shortest text. Tried when no option of the least detail is free; if none of
   * these is free either they are tried again allowed to cover pipes (never another label, a
   * blocked rect or the outside of the bounds). A function, called only when it is needed.
   */
  fallback?: () => LabelOption<T>[];
  /** Placed at its first least-detailed option even when nothing fits (status marks). */
  required?: boolean;
}

export interface PlacementInput {
  /** Labels stay inside this box. */
  bounds: Rect;
  /** Symbols and controls that labels must not cover. */
  rects?: readonly Rect[];
  segments?: readonly ThickSegment[];
  /** Things better left uncovered (houses): the option that covers fewest of them wins. */
  soft?: readonly Rect[];
  /** Free space kept between two labels, px. */
  gap?: number;
}

export function rectsOverlap(a: Rect, b: Rect, gap = 0): boolean {
  return (
    a.x < b.x + b.width + gap &&
    b.x < a.x + a.width + gap &&
    a.y < b.y + b.height + gap &&
    b.y < a.y + a.height + gap
  );
}

function contains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

/** Distance from the segment a-b to a rectangle; 0 when they touch. */
export function segmentRectDistance(
  a: { x: number; y: number },
  b: { x: number; y: number },
  rect: Rect,
): number {
  const inside = (p: { x: number; y: number }) =>
    p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height;
  if (inside(a) || inside(b)) return 0;
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
  const pointToSegment = (
    p: { x: number; y: number },
    s: { x: number; y: number },
    e: { x: number; y: number },
  ) => {
    const dx = e.x - s.x;
    const dy = e.y - s.y;
    const length2 = dx * dx + dy * dy;
    const t =
      length2 === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - s.x) * dx + (p.y - s.y) * dy) / length2));
    return Math.hypot(p.x - (s.x + t * dx), p.y - (s.y + t * dy));
  };
  const side = (
    p: { x: number; y: number },
    s: { x: number; y: number },
    e: { x: number; y: number },
  ) => Math.sign((e.x - s.x) * (p.y - s.y) - (e.y - s.y) * (p.x - s.x));
  let best = Infinity;
  for (let i = 0; i < 4; i++) {
    const c = corners[i]!;
    const d = corners[(i + 1) % 4]!;
    // Proper crossing of the segment and this edge.
    if (side(a, c, d) * side(b, c, d) < 0 && side(c, a, b) * side(d, a, b) < 0) return 0;
    best = Math.min(
      best,
      pointToSegment(c, a, b),
      pointToSegment(a, c, d),
      pointToSegment(b, c, d),
    );
  }
  return best;
}

/**
 * Approximate width of a text in the interface font, px. It errs on the wide side so that a
 * label that is measured as free is free when drawn.
 */
export function textWidth(text: string, fontSize = 12, bold = false): number {
  let em = 0;
  for (const char of text) {
    if (char === ' ') em += 0.3;
    else if (',.·:;|!\'"'.includes(char)) em += 0.32;
    else if ('ijl1tfrI/'.includes(char)) em += 0.42;
    else if (char >= '0' && char <= '9') em += 0.64;
    else if ('mwMW'.includes(char)) em += 0.9;
    else if (char >= 'A' && char <= 'Z') em += 0.72;
    else em += 0.6;
  }
  return em * fontSize * (bold ? 1.06 : 1);
}

/**
 * Chooses an option for every label, or none when the label has no free place. First every
 * label gets its shortest text, by priority, at one of its options or else at one of its
 * fallback places; then, again by priority, labels grow to a more detailed option when that
 * still touches nothing.
 */
export function placeLabels<T>(
  requests: readonly LabelRequest<T>[],
  input: PlacementInput,
): Map<string, LabelOption<T>> {
  const gap = input.gap ?? 2;
  const placed = new Map<string, LabelOption<T>>();
  const leaders = new Set<string>();
  const order = requests
    .map((request, index) => ({ request, index }))
    .sort((p, q) => q.request.priority - p.request.priority || p.index - q.index)
    .map((entry) => entry.request);

  const free = (rect: Rect, self: string, overPipes = false): boolean => {
    if (!contains(input.bounds, rect)) return false;
    for (const other of input.rects ?? []) if (rectsOverlap(rect, other)) return false;
    for (const segment of overPipes ? [] : (input.segments ?? [])) {
      if (segmentRectDistance(segment.a, segment.b, rect) < segment.half) return false;
    }
    for (const [id, option] of placed) {
      if (id !== self && rectsOverlap(rect, option.rect, gap)) return false;
    }
    return true;
  };
  const cost = (rect: Rect): number =>
    (input.soft ?? []).reduce((sum, other) => sum + (rectsOverlap(rect, other) ? 1 : 0), 0);

  /** Best free option of one detail level: the one that covers the fewest soft rects. */
  const best = (request: LabelRequest<T>, detail: number): LabelOption<T> | undefined => {
    let chosen: LabelOption<T> | undefined;
    let chosenCost = Infinity;
    for (const option of request.options) {
      if (option.detail !== detail || !free(option.rect, request.id)) continue;
      const optionCost = cost(option.rect);
      if (optionCost > (option.maxSoft ?? Infinity)) continue;
      if (optionCost < chosenCost) {
        chosen = option;
        chosenCost = optionCost;
      }
      if (optionCost === 0) break;
    }
    return chosen;
  };

  const byId = new Map(requests.map((request) => [request.id, request]));
  const fixed = (rect: Rect): boolean => {
    if (!contains(input.bounds, rect)) return false;
    for (const other of input.rects ?? []) if (rectsOverlap(rect, other)) return false;
    for (const segment of input.segments ?? []) {
      if (segmentRectDistance(segment.a, segment.b, rect) < segment.half) return false;
    }
    return true;
  };

  /**
   * Places `request` at an option of `detail` that only other labels are in the way of, when
   * each of those can move to another of its own places with the text it has now. With
   * `lowerOnly` just less important labels are moved. One level deep: the labels that move do
   * not push others.
   */
  const makeRoom = (request: LabelRequest<T>, detail: number, lowerOnly: boolean): boolean => {
    for (const option of request.options) {
      if (option.detail !== detail || !fixed(option.rect)) continue;
      if (cost(option.rect) > (option.maxSoft ?? Infinity)) continue;
      const blockers = [...placed]
        .filter(([id, other]) => id !== request.id && rectsOverlap(option.rect, other.rect, gap))
        .map(([id]) => byId.get(id)!);
      if (
        blockers.some(
          (blocker) =>
            leaders.has(blocker.id) || (lowerOnly && blocker.priority >= request.priority),
        )
      ) {
        continue;
      }
      const before = new Map(placed);
      placed.set(request.id, option);
      const moved = blockers.every((blocker) => {
        const current = placed.get(blocker.id)!;
        const other = blocker.options.find(
          (candidate) =>
            candidate !== current &&
            candidate.detail === current.detail &&
            free(candidate.rect, blocker.id) &&
            cost(candidate.rect) <= (candidate.maxSoft ?? Infinity),
        );
        if (other) placed.set(blocker.id, other);
        return other !== undefined;
      });
      if (moved) return true;
      placed.clear();
      for (const [id, previous] of before) placed.set(id, previous);
    }
    return false;
  };

  for (const request of order) {
    if (request.options.length === 0) continue;
    const least = Math.min(...request.options.map((option) => option.detail));
    let option = best(request, least);
    // Before a leader line: a neighbour may have another place as good as the one it took.
    if (!option && request.fallback && makeRoom(request, least, false)) continue;
    if (!option && request.fallback) {
      const far = request.fallback();
      option =
        far.find((o) => free(o.rect, request.id)) ??
        far.find((o) => free(o.rect, request.id, true));
      if (option) leaders.add(request.id);
    }
    option ??= request.required ? request.options.find((o) => o.detail === least) : undefined;
    if (option) placed.set(request.id, option);
  }
  for (const request of order) {
    const current = placed.get(request.id);
    if (!current) continue;
    // A label on a leader line stays short: it is already far from its element.
    if (leaders.has(request.id)) continue;
    const details = [...new Set(request.options.map((option) => option.detail))]
      .filter((detail) => detail > current.detail)
      .sort((p, q) => q - p);
    for (const detail of details) {
      const option = best(request, detail);
      if (option) {
        placed.set(request.id, option);
        break;
      }
      if (makeRoom(request, detail, true)) break;
    }
  }
  return placed;
}

/** Point of a rectangle nearest to `p`: where a leader line from `p` meets the label. */
export function nearestOnRect(p: { x: number; y: number }, rect: Rect): { x: number; y: number } {
  return {
    x: Math.min(rect.x + rect.width, Math.max(rect.x, p.x)),
    y: Math.min(rect.y + rect.height, Math.max(rect.y, p.y)),
  };
}

/**
 * Places for a label of `size` on rings around `p`, nearest first: `distances` px of clearance
 * in eight directions. For the fallback of a label whose usual places are all taken.
 */
export function ringRects(
  p: { x: number; y: number },
  size: { width: number; height: number },
  distances: readonly number[],
): Rect[] {
  const rects: Rect[] = [];
  for (const distance of distances) {
    for (const [dx, dy] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ] as const) {
      const reach = dx !== 0 && dy !== 0 ? distance * 0.72 : distance;
      rects.push({
        x: p.x + dx * (reach + size.width / 2) - size.width / 2,
        y: p.y + dy * (reach + size.height / 2) - size.height / 2,
        ...size,
      });
    }
  }
  return rects;
}

/**
 * Every place for a label of `size` on a grid over `bounds`, nearest to `p` first, up to `reach`
 * px away. The very last places tried for a label that must be shown.
 */
export function gridRects(
  p: { x: number; y: number },
  size: { width: number; height: number },
  bounds: Rect,
  step = 8,
  reach = 200,
): Rect[] {
  const rects: { rect: Rect; distance: number }[] = [];
  for (let y = bounds.y; y + size.height <= bounds.y + bounds.height; y += step) {
    for (let x = bounds.x; x + size.width <= bounds.x + bounds.width; x += step) {
      const distance = Math.hypot(x + size.width / 2 - p.x, y + size.height / 2 - p.y);
      if (distance <= reach) rects.push({ rect: { x, y, ...size }, distance });
    }
  }
  return rects.sort((a, b) => a.distance - b.distance).map((entry) => entry.rect);
}
