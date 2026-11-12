import { create } from 'zustand';
import type { HeadLossFormula } from '../engine/types';
import { initialDiameters } from '../game/buildNetwork';
import type { StageEvaluation, StageProgress } from '../game/types';
import {
  loadAllProgress,
  loadPreferences,
  saveProgress,
  savePreferences,
  type Lang,
  type NetworkViewMode,
  type ThemeSetting,
} from '../persistence/db';
import { getScenario, SCENARIOS } from '../scenarios';
import type { Diameters, Scenario } from '../scenarios/types';
import { evaluateInWorker } from '../worker/client';

export type Selection = { type: 'pipe' | 'node' | 'reservoir' | 'pump'; id: string } | null;

export interface AppState {
  // Preferences
  lang: Lang;
  theme: ThemeSetting;
  setLang: (lang: Lang) => void;
  setTheme: (theme: ThemeSetting) => void;
  /** Drawing shown in the network tab. */
  networkView: NetworkViewMode;
  setNetworkView: (mode: NetworkViewMode) => void;

  /** False until saved progress and preferences were read from IndexedDB. */
  hydrated: boolean;
  hydrate: () => Promise<void>;

  /** Saved progress by stage id. */
  progress: Record<string, StageProgress>;

  // Current stage (null on the stage select screen)
  scenario: Scenario | null;
  /** DN in mm by pipe id for the open stage. */
  diameters: Diameters;
  formula: HeadLossFormula;
  selection: Selection;
  /** Last evaluation of the open stage. */
  evaluation: StageEvaluation | null;
  /** True when diameters or formula changed after `evaluation` was computed. */
  stale: boolean;
  solving: boolean;
  error: string | null;
  /**
   * Time (ms) of the last "Calcular / Verificar" the player ran in the open stage, or null.
   * Opening a stage does not set it. Views use a change of this value to start the success or
   * failure feedback.
   */
  verifiedAt: number | null;

  openStage: (stageId: string) => Promise<void>;
  closeStage: () => void;
  setDiameter: (pipeId: string, dn: number) => void;
  resetDiameters: () => void;
  setFormula: (formula: HeadLossFormula) => void;
  select: (selection: Selection) => void;
  /** Runs the solver and the checks ("Calcular / Verificar") and records progress. */
  verify: () => Promise<void>;
}

/** Stage 1 is always unlocked; stage n needs stage n−1 completed. */
export function isUnlocked(scenario: Scenario, progress: Record<string, StageProgress>): boolean {
  if (scenario.order <= 1) return true;
  const previous = SCENARIOS.find((s) => s.order === scenario.order - 1);
  return previous ? progress[previous.id]?.completed === true : true;
}

function mergeProgress(
  previous: StageProgress | undefined,
  stageId: string,
  diameters: Diameters,
  evaluation: StageEvaluation | null,
): StageProgress {
  const base: StageProgress = previous ?? {
    stageId,
    completed: false,
    stars: 0,
    bestCost: null,
    diameters,
    updatedAt: 0,
  };
  const next: StageProgress = { ...base, diameters: { ...diameters }, updatedAt: Date.now() };
  if (evaluation?.passed) {
    next.completed = true;
    next.stars = Math.max(base.stars, evaluation.stars) as StageProgress['stars'];
    next.bestCost =
      base.bestCost === null ? evaluation.cost : Math.min(base.bestCost, evaluation.cost);
  }
  return next;
}

export const useAppStore = create<AppState>((set, get) => {
  const persist = (evaluation: StageEvaluation | null) => {
    const { scenario, diameters, progress } = get();
    if (!scenario) return;
    const next = mergeProgress(progress[scenario.id], scenario.id, diameters, evaluation);
    set({ progress: { ...progress, [scenario.id]: next } });
    void saveProgress(next).catch(() => undefined);
  };

  return {
    lang: 'pt',
    theme: 'system',
    setLang: (lang) => {
      set({ lang });
      void savePreferences({ lang }).catch(() => undefined);
    },
    setTheme: (theme) => {
      set({ theme });
      void savePreferences({ theme }).catch(() => undefined);
    },
    networkView: 'town',
    setNetworkView: (networkView) => {
      set({ networkView });
      void savePreferences({ networkView }).catch(() => undefined);
    },

    hydrated: false,
    hydrate: async () => {
      try {
        const [progress, preferences] = await Promise.all([loadAllProgress(), loadPreferences()]);
        set({ progress, ...preferences, hydrated: true });
      } catch {
        // IndexedDB can be unavailable (private mode); the app still works without saving.
        set({ hydrated: true });
      }
    },

    progress: {},

    scenario: null,
    diameters: {},
    formula: 'hazen-williams',
    selection: null,
    evaluation: null,
    stale: false,
    solving: false,
    error: null,
    verifiedAt: null,

    openStage: async (stageId) => {
      const scenario = getScenario(stageId);
      if (!scenario || !isUnlocked(scenario, get().progress)) return;
      const saved = get().progress[stageId]?.diameters;
      set({
        scenario,
        diameters: { ...initialDiameters(scenario), ...saved },
        formula: scenario.formula,
        selection: null,
        evaluation: null,
        stale: false,
        error: null,
        verifiedAt: null,
      });
      // Solve once so the network is drawn with pressures and velocities. This first
      // evaluation is not recorded as an attempt.
      set({ solving: true });
      try {
        const evaluation = await evaluateInWorker(stageId, get().diameters, get().formula);
        if (get().scenario?.id === stageId) set({ evaluation, stale: false });
      } catch (error) {
        set({ error: error instanceof Error ? error.message : String(error) });
      } finally {
        set({ solving: false });
      }
    },

    closeStage: () =>
      set({
        scenario: null,
        diameters: {},
        selection: null,
        evaluation: null,
        error: null,
        verifiedAt: null,
      }),

    setDiameter: (pipeId, dn) => {
      const { scenario, diameters } = get();
      const pipe = scenario?.pipes.find((p) => p.id === pipeId);
      if (!scenario || !pipe || pipe.fixed || diameters[pipeId] === dn) return;
      set({ diameters: { ...diameters, [pipeId]: dn }, stale: true });
      persist(null);
    },

    resetDiameters: () => {
      const { scenario } = get();
      if (!scenario) return;
      set({ diameters: initialDiameters(scenario), stale: true });
      persist(null);
    },

    setFormula: (formula) => {
      if (get().formula !== formula) set({ formula, stale: true });
    },

    select: (selection) => set({ selection }),

    verify: async () => {
      const { scenario, diameters, formula } = get();
      if (!scenario) return;
      set({ solving: true, error: null });
      try {
        const evaluation = await evaluateInWorker(scenario.id, diameters, formula);
        if (get().scenario?.id !== scenario.id) return;
        set({ evaluation, stale: false, verifiedAt: Date.now() });
        persist(evaluation);
      } catch (error) {
        set({ error: error instanceof Error ? error.message : String(error) });
      } finally {
        set({ solving: false });
      }
    },
  };
});
