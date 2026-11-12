import type { StageProgress } from '../game/types';

/** All saved stage progress, by stage id. */
export async function loadAllProgress(): Promise<Record<string, StageProgress>> {
  return {};
}

/** Inserts or replaces the progress of one stage. */
export async function saveProgress(_progress: StageProgress): Promise<void> {}

/** Deletes all saved progress. */
export async function clearProgress(): Promise<void> {}

export type Lang = 'pt' | 'en';
export type ThemeSetting = 'system' | 'light' | 'dark';

export interface Preferences {
  lang: Lang;
  theme: ThemeSetting;
}

export async function loadPreferences(): Promise<Partial<Preferences>> {
  return {};
}

export async function savePreferences(_preferences: Partial<Preferences>): Promise<void> {}
