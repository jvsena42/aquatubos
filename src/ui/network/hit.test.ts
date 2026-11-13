import {
  distanceToSegment,
  distanceToShape,
  HIT_PRIORITY,
  hitReach,
  hitTargetSize,
  MOUSE_REACH,
  NODE_CLAIM,
  resolveHit,
  TOUCH_REACH,
  trimSegment,
  type HitTarget,
} from './hit';

/**
 * A 60 px pipe between two nodes, like the fitted stage 4 on a 360 px phone, and a parallel
 * pipe 30 px below it: the 44 px hit areas of all four overlap.
 */
const A = { x: 100, y: 100 };
const B = { x: 160, y: 100 };
const pipe = (id: string, a: typeof A, b: typeof A): HitTarget<string> => ({
  data: id,
  priority: HIT_PRIORITY.pipe,
  shapes: [{ kind: 'capsule', ...trimSegment(a, b, NODE_CLAIM), half: 2 }],
});
const node = (id: string, p: typeof A): HitTarget<string> => ({
  data: id,
  priority: HIT_PRIORITY.node,
  shapes: [{ kind: 'disc', ...p, r: 10 }],
});
const TARGETS = [
  pipe('T1', A, B),
  pipe('T2', { x: 100, y: 130 }, { x: 160, y: 130 }),
  node('A', A),
  node('B', B),
];

describe('distances', () => {
  it('measures to the nearest point of a segment, ends included', () => {
    expect(distanceToSegment({ x: 130, y: 110 }, A, B)).toBeCloseTo(10, 9);
    // Beyond the end B: straight to B, 3-4-5.
    expect(distanceToSegment({ x: 163, y: 104 }, A, B)).toBeCloseTo(5, 9);
    expect(distanceToSegment({ x: 103, y: 104 }, A, A)).toBeCloseTo(5, 9);
  });

  it('is zero inside a shape, measured from its edge outside, plus the bias', () => {
    expect(distanceToShape({ x: 105, y: 100 }, { kind: 'disc', ...A, r: 10 })).toBe(0);
    expect(distanceToShape({ x: 125, y: 100 }, { kind: 'disc', ...A, r: 10 })).toBeCloseTo(15, 9);
    expect(
      distanceToShape({ x: 130, y: 107 }, { kind: 'capsule', a: A, b: B, half: 2 }),
    ).toBeCloseTo(5, 9);
    expect(distanceToShape({ x: 105, y: 100 }, { kind: 'disc', ...A, r: 10, bias: 6 })).toBe(6);
  });
});

describe('trimSegment', () => {
  it('leaves the ends of a pipe to its nodes', () => {
    expect(trimSegment(A, B, 16)).toEqual({ a: { x: 116, y: 100 }, b: { x: 144, y: 100 } });
  });

  it('never takes more than the share from a short pipe', () => {
    // 20 px long: 30 % at each end, 6 px.
    const trimmed = trimSegment(A, { x: 120, y: 100 }, 16);
    expect(trimmed.a.x).toBeCloseTo(106, 9);
    expect(trimmed.b.x).toBeCloseTo(114, 9);
  });

  it('keeps a pipe without length', () => {
    expect(trimSegment(A, A, 16)).toEqual({ a: A, b: A });
  });
});

describe('resolveHit', () => {
  it('picks the nearer of two pipes whose hit areas overlap', () => {
    // 12 px below T1 and 18 px above T2: inside the 44 px band of both.
    expect(resolveHit({ x: 130, y: 112 }, TARGETS, TOUCH_REACH)).toBe('T1');
    expect(resolveHit({ x: 130, y: 119 }, TARGETS, TOUCH_REACH)).toBe('T2');
  });

  it('does not depend on the order of the targets', () => {
    const reversed = [...TARGETS].reverse();
    expect(resolveHit({ x: 130, y: 112 }, reversed, TOUCH_REACH)).toBe('T1');
    expect(resolveHit({ x: 130, y: 119 }, reversed, TOUCH_REACH)).toBe('T2');
  });

  it('gives the end of a pipe to its node and the middle to the pipe', () => {
    expect(resolveHit({ x: 101, y: 101 }, TARGETS, TOUCH_REACH)).toBe('A');
    // 12 px along the pipe from A: 2 px outside the node, 4 px before the trimmed pipe.
    expect(resolveHit({ x: 112, y: 100 }, TARGETS, TOUCH_REACH)).toBe('A');
    expect(resolveHit({ x: 118, y: 100 }, TARGETS, TOUCH_REACH)).toBe('T1');
    expect(resolveHit({ x: 130, y: 100 }, TARGETS, TOUCH_REACH)).toBe('T1');
  });

  it('prefers the higher priority when the tap is inside two drawings', () => {
    const overlapping = [
      pipe('T', { x: 80, y: 100 }, { x: 180, y: 100 }),
      node('N', { x: 130, y: 100 }),
    ];
    expect(resolveHit({ x: 133, y: 100 }, overlapping, TOUCH_REACH)).toBe('N');
    expect(resolveHit({ x: 133, y: 100 }, overlapping.reverse(), TOUCH_REACH)).toBe('N');
  });

  it('reaches 22 px for a finger and 12 px for a mouse', () => {
    expect(hitReach('touch')).toBe(TOUCH_REACH);
    expect(hitReach('mouse')).toBe(MOUSE_REACH);
    expect(hitTargetSize(true)).toBe(44);
    expect(hitTargetSize(false)).toBeLessThan(44);
    // 20 px above the pipe edge.
    expect(resolveHit({ x: 130, y: 78 }, TARGETS, TOUCH_REACH)).toBe('T1');
    expect(resolveHit({ x: 130, y: 78 }, TARGETS, MOUSE_REACH)).toBeNull();
    expect(resolveHit({ x: 130, y: 60 }, TARGETS, TOUCH_REACH)).toBeNull();
  });

  it('lets a biased shape win only where nothing else is close', () => {
    // A house of node N beside the street T: on the house but 3 px from the street edge.
    const street: HitTarget<string> = pipe('T', { x: 0, y: 100 }, { x: 200, y: 100 });
    const houses: HitTarget<string> = {
      data: 'N',
      priority: HIT_PRIORITY.node,
      shapes: [
        { kind: 'disc', x: 200, y: 100, r: 10 },
        { kind: 'disc', x: 100, y: 110, r: 5, bias: 6 },
        { kind: 'disc', x: 100, y: 130, r: 5, bias: 6 },
      ],
    };
    expect(resolveHit({ x: 100, y: 105 }, [street, houses], TOUCH_REACH)).toBe('T');
    // On the second row of houses, 28 px from the street: the node.
    expect(resolveHit({ x: 100, y: 130 }, [street, houses], TOUCH_REACH)).toBe('N');
  });

  it('returns null without targets', () => {
    expect(resolveHit({ x: 0, y: 0 }, [], TOUCH_REACH)).toBeNull();
  });
});
