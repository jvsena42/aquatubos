import { fixtureScenarios, makeProgress } from '../../test/fixtures';
import { homeAction, summarizeProgress } from './homeModel';

const [first, second, third] = fixtureScenarios as [
  (typeof fixtureScenarios)[0],
  (typeof fixtureScenarios)[0],
  (typeof fixtureScenarios)[0],
];
const design = (id: string) => makeProgress(id, { completed: false, stars: 0, bestCost: null });

describe('homeAction', () => {
  it('offers to play when nothing is saved', () => {
    expect(homeAction(fixtureScenarios, {})).toEqual({ kind: 'play' });
  });

  it('continues on stage 1 when only a design is saved', () => {
    expect(homeAction(fixtureScenarios, { 'stage-1': design('stage-1') })).toEqual({
      kind: 'continue',
      stage: first,
    });
  });

  it('continues on the first stage that is not completed', () => {
    const progress = { 'stage-1': makeProgress('stage-1'), 'stage-2': makeProgress('stage-2') };
    expect(homeAction(fixtureScenarios, progress)).toEqual({ kind: 'continue', stage: third });
    expect(homeAction(fixtureScenarios, { 'stage-1': makeProgress('stage-1') })).toEqual({
      kind: 'continue',
      stage: second,
    });
  });

  it('continues on a stage that has a design but is not completed', () => {
    const progress = { 'stage-1': makeProgress('stage-1'), 'stage-2': design('stage-2') };
    expect(homeAction(fixtureScenarios, progress)).toEqual({ kind: 'continue', stage: second });
  });

  it('reports the last stage when every stage is completed', () => {
    const progress = Object.fromEntries(fixtureScenarios.map((s) => [s.id, makeProgress(s.id)]));
    expect(homeAction(fixtureScenarios, progress)).toEqual({ kind: 'done', stage: third });
  });

  it('follows the stage order, not the array order', () => {
    const shuffled = [third, first, second];
    expect(homeAction(shuffled, { 'stage-1': makeProgress('stage-1') })).toEqual({
      kind: 'continue',
      stage: second,
    });
  });

  it('ignores progress of stages that no longer exist', () => {
    expect(homeAction(fixtureScenarios, { old: makeProgress('old') })).toEqual({ kind: 'play' });
  });
});

describe('summarizeProgress', () => {
  it('is empty without progress', () => {
    expect(summarizeProgress(fixtureScenarios, {})).toEqual({
      hasProgress: false,
      stars: 0,
      maxStars: 9,
      completed: 0,
      total: 3,
      bestCostTotal: null,
      costStages: 0,
    });
  });

  it('counts a saved design as progress without stars or cost', () => {
    const summary = summarizeProgress(fixtureScenarios, { 'stage-1': design('stage-1') });
    expect(summary).toMatchObject({ hasProgress: true, stars: 0, completed: 0, costStages: 0 });
    expect(summary.bestCostTotal).toBeNull();
  });

  it('adds up stars and best costs of the completed stages', () => {
    const summary = summarizeProgress(fixtureScenarios, {
      'stage-1': makeProgress('stage-1', { stars: 3, bestCost: 1000 }),
      'stage-2': makeProgress('stage-2', { stars: 1, bestCost: 2500.5 }),
      'stage-3': design('stage-3'),
    });
    // 3 + 1 stars of 3 × 3; 1000 + 2500.5 = 3500.5 over two stages.
    expect(summary).toEqual({
      hasProgress: true,
      stars: 4,
      maxStars: 9,
      completed: 2,
      total: 3,
      bestCostTotal: 3500.5,
      costStages: 2,
    });
  });

  it('leaves out stars of a stage that is not completed and unknown stages', () => {
    const summary = summarizeProgress(fixtureScenarios, {
      'stage-1': makeProgress('stage-1', { completed: false, stars: 2, bestCost: 900 }),
      old: makeProgress('old'),
    });
    expect(summary).toMatchObject({ stars: 0, completed: 0, bestCostTotal: null });
  });
});
