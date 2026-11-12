import { clearProgress, loadAllProgress, loadPreferences } from '../persistence/db';
import { getScenario } from '../scenarios';
import { isUnlocked, useAppStore } from './store';
import { resetStore } from '../test/store';

const stage1 = getScenario('stage1')!;
const stage2 = getScenario('stage2')!;

describe('app store', () => {
  beforeEach(async () => {
    await clearProgress();
    resetStore();
  });

  it('opens stage 1 with its initial diameters and solves it once', async () => {
    await useAppStore.getState().openStage('stage1');
    const state = useAppStore.getState();
    expect(state.scenario?.id).toBe('stage1');
    expect(state.diameters).toEqual({ T1: 50, T2: 50, T3: 50, T4: 50, T5: 50 });
    expect(state.evaluation?.passed).toBe(false);
    expect(state.stale).toBe(false);
    expect(state.solving).toBe(false);
    // Opening a stage is not an attempt.
    expect(state.verifiedAt).toBeNull();
    expect(state.progress.stage1).toBeUndefined();
  });

  it('does not open a locked or unknown stage', async () => {
    await useAppStore.getState().openStage('stage2');
    expect(useAppStore.getState().scenario).toBeNull();
    await useAppStore.getState().openStage('nope');
    expect(useAppStore.getState().scenario).toBeNull();
    expect(isUnlocked(stage1, {})).toBe(true);
    expect(isUnlocked(stage2, {})).toBe(false);
  });

  it('marks results stale when a diameter changes and saves the design', async () => {
    const store = useAppStore.getState();
    await store.openStage('stage1');
    store.setDiameter('T1', 100);
    expect(useAppStore.getState().diameters.T1).toBe(100);
    expect(useAppStore.getState().stale).toBe(true);
    expect(useAppStore.getState().progress.stage1?.completed).toBe(false);
    // Same value or unknown pipe: nothing changes.
    useAppStore.setState({ stale: false });
    store.setDiameter('T1', 100);
    store.setDiameter('T99', 100);
    expect(useAppStore.getState().stale).toBe(false);
  });

  it('records completion, stars and best cost when a design passes', async () => {
    const store = useAppStore.getState();
    await store.openStage('stage1');
    // Oversized but passing design first.
    for (const pipe of stage1.pipes) store.setDiameter(pipe.id, 150);
    await store.verify();
    let progress = useAppStore.getState().progress.stage1!;
    expect(useAppStore.getState().evaluation?.passed).toBe(true);
    expect(useAppStore.getState().stale).toBe(false);
    expect(progress.completed).toBe(true);
    expect(progress.stars).toBe(1);
    expect(useAppStore.getState().verifiedAt).not.toBeNull();
    const firstCost = progress.bestCost!;

    for (const [id, dn] of Object.entries(stage1.reference.diameters)) store.setDiameter(id, dn);
    await store.verify();
    progress = useAppStore.getState().progress.stage1!;
    expect(progress.stars).toBe(3);
    expect(progress.bestCost).toBeCloseTo(stage1.reference.cost, 2);
    expect(progress.bestCost!).toBeLessThan(firstCost);

    // A later failing attempt keeps the record.
    store.resetDiameters();
    await store.verify();
    progress = useAppStore.getState().progress.stage1!;
    expect(useAppStore.getState().evaluation?.passed).toBe(false);
    expect(progress.completed).toBe(true);
    expect(progress.stars).toBe(3);

    expect(isUnlocked(stage2, useAppStore.getState().progress)).toBe(true);
    const saved = await loadAllProgress();
    expect(saved.stage1?.stars).toBe(3);
  });

  it('restores the saved design after a reload', async () => {
    const store = useAppStore.getState();
    await store.openStage('stage1');
    store.setDiameter('T2', 75);
    await new Promise((resolve) => setTimeout(resolve, 20));
    resetStore();
    await useAppStore.getState().hydrate();
    expect(useAppStore.getState().hydrated).toBe(true);
    await useAppStore.getState().openStage('stage1');
    expect(useAppStore.getState().diameters.T2).toBe(75);
  });

  it('marks results stale when the formula changes', async () => {
    const store = useAppStore.getState();
    await store.openStage('stage1');
    store.setFormula('hazen-williams');
    expect(useAppStore.getState().stale).toBe(false);
    store.setFormula('darcy-weisbach');
    expect(useAppStore.getState().stale).toBe(true);
    await store.verify();
    expect(useAppStore.getState().evaluation?.result.formula).toBe('darcy-weisbach');
  });

  it('saves language and theme', async () => {
    useAppStore.getState().setLang('en');
    useAppStore.getState().setTheme('dark');
    expect(useAppStore.getState().networkView).toBe('town');
    useAppStore.getState().setNetworkView('schematic');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await loadPreferences()).toMatchObject({
      lang: 'en',
      theme: 'dark',
      networkView: 'schematic',
    });
  });

  it('clears the stage on close and ignores stage actions without a stage', async () => {
    const store = useAppStore.getState();
    await store.openStage('stage1');
    store.select({ type: 'pipe', id: 'T1' });
    expect(useAppStore.getState().selection).toEqual({ type: 'pipe', id: 'T1' });
    store.closeStage();
    expect(useAppStore.getState().scenario).toBeNull();
    // Leaving a stage returns to the stage map, not to the title screen.
    expect(useAppStore.getState().screen).toBe('map');
    store.goHome();
    expect(useAppStore.getState().screen).toBe('home');
    store.goToMap();
    expect(useAppStore.getState().screen).toBe('map');
    expect(useAppStore.getState().evaluation).toBeNull();
    store.setDiameter('T1', 100);
    store.resetDiameters();
    await store.verify();
    expect(useAppStore.getState().diameters).toEqual({});
  });
});
