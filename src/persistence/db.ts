import Dexie, { type Table } from 'dexie';
import type { StageProgress } from '../game/types';

export type Lang = 'pt' | 'en';
export type ThemeSetting = 'system' | 'light' | 'dark';

export interface Preferences {
  lang: Lang;
  theme: ThemeSetting;
}

interface PreferenceRow {
  key: keyof Preferences;
  value: string;
}

class AquatubosDb extends Dexie {
  progress!: Table<StageProgress, string>;
  preferences!: Table<PreferenceRow, string>;

  constructor() {
    super('aquatubos');
    this.version(1).stores({ progress: 'stageId', preferences: 'key' });
  }
}

let instance: AquatubosDb | null = null;

function db(): AquatubosDb {
  instance ??= new AquatubosDb();
  return instance;
}

/** All saved stage progress, by stage id. */
export async function loadAllProgress(): Promise<Record<string, StageProgress>> {
  const rows = await db().progress.toArray();
  return Object.fromEntries(rows.map((row) => [row.stageId, row]));
}

/** Inserts or replaces the progress of one stage. */
export async function saveProgress(progress: StageProgress): Promise<void> {
  await db().progress.put(progress);
}

/** Deletes all saved progress. */
export async function clearProgress(): Promise<void> {
  await db().progress.clear();
}

const LANGS: readonly string[] = ['pt', 'en'] satisfies Lang[];
const THEMES: readonly string[] = ['system', 'light', 'dark'] satisfies ThemeSetting[];

/** Saved preferences. Unknown or invalid stored values are left out. */
export async function loadPreferences(): Promise<Partial<Preferences>> {
  const rows = await db().preferences.toArray();
  const preferences: Partial<Preferences> = {};
  for (const row of rows) {
    if (row.key === 'lang' && LANGS.includes(row.value)) preferences.lang = row.value as Lang;
    if (row.key === 'theme' && THEMES.includes(row.value)) {
      preferences.theme = row.value as ThemeSetting;
    }
  }
  return preferences;
}

/** Saves the given preferences and keeps the ones that were not passed. */
export async function savePreferences(preferences: Partial<Preferences>): Promise<void> {
  const rows: PreferenceRow[] = [];
  if (preferences.lang !== undefined) rows.push({ key: 'lang', value: preferences.lang });
  if (preferences.theme !== undefined) rows.push({ key: 'theme', value: preferences.theme });
  if (rows.length > 0) await db().preferences.bulkPut(rows);
}
