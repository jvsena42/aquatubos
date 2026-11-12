import type { Scenario } from '../../scenarios/types';

export interface FillOrder {
  /** Distance (m) along the network from the nearest reservoir to each node. */
  nodes: Record<string, number>;
  /** For each pipe or pump: the end the water reaches first and the distances of both ends. */
  links: Record<string, { first: string; start: number; end: number }>;
  /** Largest finite distance, m. */
  longest: number;
}

/**
 * Order in which water reaches the network when it fills from the reservoirs: shortest path
 * along pipe lengths (pumps count as their plan length). Used to time the success animation.
 */
export function fillOrder(scenario: Scenario): FillOrder {
  const position = new Map(
    [...scenario.nodes, ...scenario.reservoirs].map((n) => [n.id, { x: n.x, y: n.y }]),
  );
  const links = [
    ...scenario.pipes.map((pipe) => ({ ...pipe, weight: pipe.length })),
    ...scenario.pumps.map((pump) => {
      const a = position.get(pump.from);
      const b = position.get(pump.to);
      return {
        id: pump.id,
        from: pump.from,
        to: pump.to,
        weight: a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0,
      };
    }),
  ];
  const reached: Record<string, number> = {};
  for (const id of position.keys()) reached[id] = Infinity;
  for (const reservoir of scenario.reservoirs) reached[reservoir.id] = 0;
  // Bellman-Ford style relaxation: the networks are small.
  for (let pass = 0; pass < position.size; pass++) {
    let changed = false;
    for (const link of links) {
      const a = reached[link.from] ?? Infinity;
      const b = reached[link.to] ?? Infinity;
      if (a + link.weight < b) {
        reached[link.to] = a + link.weight;
        changed = true;
      } else if (b + link.weight < a) {
        reached[link.from] = b + link.weight;
        changed = true;
      }
    }
    if (!changed) break;
  }
  const order: FillOrder['links'] = {};
  for (const link of links) {
    const a = reached[link.from] ?? Infinity;
    const b = reached[link.to] ?? Infinity;
    order[link.id] =
      a <= b
        ? { first: link.from, start: a, end: Math.max(a, b) }
        : { first: link.to, start: b, end: a };
  }
  const finite = Object.values(reached).filter(Number.isFinite);
  return { nodes: reached, links: order, longest: Math.max(0, ...finite) };
}
