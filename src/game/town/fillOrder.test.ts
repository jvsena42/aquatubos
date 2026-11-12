import { getScenario } from '../../scenarios';
import { fillOrder } from './fillOrder';

describe('fillOrder', () => {
  it('orders a branched network by pipe length from the reservoir', () => {
    const order = fillOrder(getScenario('stage1')!);
    // R1 -T1 (300 m)-> N1 -T2 (250 m)-> N2 -T3 (200 m)-> N3; N1 -T4 (200 m)-> N4.
    expect(order.nodes).toMatchObject({ R1: 0, N1: 300, N2: 550, N3: 750, N4: 500, N5: 700 });
    expect(order.links.T3).toEqual({ first: 'N2', start: 550, end: 750 });
    expect(order.longest).toBe(750);
  });

  it('takes the shorter way round a loop and fills a pipe from its nearer end', () => {
    const order = fillOrder(getScenario('stage3')!);
    // C is reached through B (250 + 350 + 420) or D (250 + 400 + 360): D is shorter.
    expect(order.nodes.C).toBe(1010);
    expect(order.links.T5).toEqual({ first: 'D', start: 650, end: 1010 });
    // T3 is written B -> C; both ends are reached before the water crosses it.
    expect(order.links.T3).toEqual({ first: 'B', start: 600, end: 1010 });
  });

  it('crosses a pump by its plan length', () => {
    const order = fillOrder(getScenario('stage5')!);
    expect(order.nodes.J1).toBe(220);
    expect(order.links.B1).toEqual({ first: 'R1', start: 0, end: 220 });
    expect(order.nodes.N2).toBe(520);
  });
});
