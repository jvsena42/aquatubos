import Dexie from 'dexie';
import type { StageProgress } from '../game/types';
import {
  clearProgress,
  loadAllProgress,
  loadPreferences,
  saveProgress,
  savePreferences,
} from './db';

const stage1: StageProgress = {
  stageId: 'stage-1',
  completed: true,
  stars: 2,
  bestCost: 12345.67,
  diameters: { p1: 100, p2: 75 },
  updatedAt: 1000,
};

describe('persistence', () => {
  beforeEach(async () => {
    await clearProgress();
  });

  it('uses the IndexedDB database named aquatubos', async () => {
    await saveProgress(stage1);
    expect(await Dexie.exists('aquatubos')).toBe(true);
  });

  it('returns no progress when nothing was saved', async () => {
    expect(await loadAllProgress()).toEqual({});
  });

  it('round-trips stage progress by stage id', async () => {
    const stage2: StageProgress = { ...stage1, stageId: 'stage-2', completed: false, stars: 0 };
    await saveProgress(stage1);
    await saveProgress(stage2);
    expect(await loadAllProgress()).toEqual({ 'stage-1': stage1, 'stage-2': stage2 });
  });

  it('replaces the progress of a stage that was already saved', async () => {
    await saveProgress(stage1);
    await saveProgress({ ...stage1, stars: 3, bestCost: 9000 });
    const all = await loadAllProgress();
    expect(Object.keys(all)).toEqual(['stage-1']);
    expect(all['stage-1']).toMatchObject({ stars: 3, bestCost: 9000 });
  });

  it('clears all progress', async () => {
    await saveProgress(stage1);
    await clearProgress();
    expect(await loadAllProgress()).toEqual({});
  });

  it('saves preferences one at a time without losing the others', async () => {
    await savePreferences({ lang: 'en' });
    await savePreferences({ theme: 'dark' });
    expect(await loadPreferences()).toEqual({ lang: 'en', theme: 'dark' });
    await savePreferences({ lang: 'pt' });
    expect(await loadPreferences()).toEqual({ lang: 'pt', theme: 'dark' });
  });

  it('keeps progress when preferences are saved', async () => {
    await saveProgress(stage1);
    await savePreferences({ theme: 'light' });
    expect(await loadAllProgress()).toEqual({ 'stage-1': stage1 });
  });
});
