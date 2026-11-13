import { evaluateStage } from '../../game/evaluate';
import { getScenario } from '../../scenarios';
import { buildLabels, LABEL_PRIORITY, type LabelTexts } from './labels';
import { buildSceneModel } from './model';

const texts: LabelTexts = {
  pipe: (dn) => `DN ${dn}`,
  node: (id, pressure) => (pressure === null ? id : `${id} · ${pressure.toFixed(1)} mca`),
  nodeCompact: (id, pressure) => (pressure === null ? id : `${id} · ${pressure.toFixed(1)}`),
  reservoir: (id, level) => `${id} · NA ${level.toFixed(1)} m`,
  pump: (id) => `${id} · Bomba`,
};

function model(id: string, solved = true) {
  const scenario = getScenario(id)!;
  const diameters = scenario.reference.diameters;
  return buildSceneModel(
    scenario,
    diameters,
    solved ? evaluateStage(scenario, diameters) : null,
    5,
  );
}

describe('buildLabels on a wide screen', () => {
  const stage5 = model('stage5');
  const labels = buildLabels(stage5, texts, { compact: false, selection: null });

  it('labels every pipe, node, reservoir and pump in full', () => {
    expect(labels).toHaveLength(
      stage5.pipes.length + stage5.nodes.length + stage5.reservoirs.length + stage5.pumps.length,
    );
    expect(labels.filter((l) => l.kind === 'pipe').map((l) => l.text)).toEqual(
      stage5.pipes.map((p) => `DN ${p.dn}`),
    );
    expect(labels.find((l) => l.id === 'node-N4')!.text).toBe('N4 · 10.0 mca');
    expect(labels.find((l) => l.id === 'reservoir-R1')!.text).toBe('R1 · NA 100.0 m');
    expect(labels.find((l) => l.id === 'pump-B1')!.text).toBe('B1 · Bomba');
  });

  it('has no short forms: nothing is thinned out', () => {
    expect(labels.every((l) => l.short === undefined)).toBe(true);
  });

  it('anchors each label above its element', () => {
    for (const node of stage5.nodes) {
      const label = labels.find((l) => l.id === `node-${node.id}`)!;
      expect(label.position.x).toBe(node.position.x);
      expect(label.position.z).toBe(node.position.z);
      expect(label.position.y).toBeGreaterThan(node.position.y + node.radius);
    }
  });
});

describe('buildLabels on a small screen', () => {
  const stage5 = model('stage5');

  it('drops the pipe labels and shortens the others', () => {
    const wide = buildLabels(stage5, texts, { compact: false, selection: null });
    const labels = buildLabels(stage5, texts, { compact: true, selection: null });
    expect(labels.length).toBe(wide.length - stage5.pipes.length);
    expect(labels.some((l) => l.kind === 'pipe')).toBe(false);
    expect(labels.find((l) => l.id === 'node-N4')).toMatchObject({
      text: 'N4 · 10.0',
      short: 'N4',
    });
    expect(labels.find((l) => l.id === 'reservoir-R1')!.text).toBe('R1');
    expect(labels.find((l) => l.id === 'pump-B1')!.text).toBe('B1');
    for (const label of labels) {
      const full = wide.find((l) => l.id === label.id)!;
      expect(label.text.length).toBeLessThan(full.text.length);
      expect(label.position).toEqual(full.position);
    }
  });

  it('shows the selected element in full, a pipe included, above everything else', () => {
    const pipe = buildLabels(stage5, texts, {
      compact: true,
      selection: { type: 'pipe', id: 'T4' },
    });
    const pipeLabels = pipe.filter((l) => l.kind === 'pipe');
    expect(pipeLabels).toHaveLength(1);
    expect(pipeLabels[0]).toMatchObject({
      id: 'pipe-T4',
      text: `T4 · DN ${stage5.pipes.find((p) => p.id === 'T4')!.dn}`,
      priority: LABEL_PRIORITY.selected,
    });

    const node = buildLabels(stage5, texts, {
      compact: true,
      selection: { type: 'node', id: 'N3' },
    });
    const selected = node.find((l) => l.id === 'node-N3')!;
    expect(selected.text).toBe('N3 · 18.7 mca');
    expect(selected.short).toBeUndefined();
    expect(selected.priority).toBe(LABEL_PRIORITY.selected);
    expect(Math.max(...node.map((l) => l.priority))).toBe(selected.priority);

    const tank = buildLabels(stage5, texts, {
      compact: true,
      selection: { type: 'reservoir', id: 'R1' },
    });
    expect(tank.find((l) => l.id === 'reservoir-R1')!.text).toBe('R1 · NA 100.0 m');
    const pump = buildLabels(stage5, texts, {
      compact: true,
      selection: { type: 'pump', id: 'B1' },
    });
    expect(pump.find((l) => l.id === 'pump-B1')!.text).toBe('B1 · Bomba');
  });

  it('ranks the critical node over the other nodes and under the reservoir', () => {
    const labels = buildLabels(stage5, texts, { compact: true, selection: null, criticalId: 'N4' });
    const priority = (id: string) => labels.find((l) => l.id === id)!.priority;
    expect(priority('node-N4')).toBeGreaterThan(priority('node-N3'));
    expect(priority('node-N4')).toBeGreaterThan(priority('reservoir-R1'));
    expect(priority('reservoir-R1')).toBeGreaterThan(priority('pump-B1'));
    expect(priority('pump-B1')).toBeGreaterThan(priority('node-N3'));
  });

  it('labels nodes with the id alone, and no short form, before there is a result', () => {
    const labels = buildLabels(model('stage2', false), texts, { compact: true, selection: null });
    const nodes = labels.filter((l) => l.kind === 'node');
    expect(nodes.map((l) => l.text)).toEqual(nodes.map((l) => l.element));
    expect(nodes.every((l) => l.short === undefined)).toBe(true);
  });
});
