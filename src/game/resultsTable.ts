import type { CheckIssue, CheckSeverity, LocalizedText } from '../engine/types';
import { m3sToLps } from '../engine/units';
import type { Scenario } from '../scenarios/types';
import type { StageEvaluation } from './types';

type Lang = keyof LocalizedText;

/** A value outside a limit that the stage checks. */
export interface LimitFlag {
  kind: 'low' | 'high';
  severity: CheckSeverity;
  /** Limit that was violated, in the unit of the column (m/s or m). */
  limit: number;
}

/**
 * One row of the results spreadsheet. Values are in display units and already oriented in the
 * actual flow direction: `upstream` is the node the water comes from, flow, velocity and head
 * loss are positive.
 */
export interface PipeTableRow {
  id: string;
  upstream: string;
  downstream: string;
  /** True when the water runs against the direction the pipe was drawn (to → from). */
  reversed: boolean;
  /** m */
  length: number;
  /** L/s */
  flow: number;
  /** mm */
  dn: number;
  /** m/s */
  velocity: number;
  /** m/km */
  unitHeadLoss: number;
  /** m */
  headLoss: number;
  /** Hydraulic grade, m. */
  headUp: number;
  headDown: number;
  /** Ground elevation, m. */
  elevationUp: number;
  elevationDown: number;
  /** Available pressure head (hydraulic grade − ground elevation), m. */
  pressureUp: number;
  pressureDown: number;
  velocityFlag: LimitFlag | null;
  pressureUpFlag: LimitFlag | null;
  pressureDownFlag: LimitFlag | null;
}

export interface NodeTableRow {
  id: string;
  kind: 'node' | 'reservoir';
  /** Ground elevation, m. */
  elevation: number;
  /** L/s. Null for reservoirs. */
  demand: number | null;
  /** Hydraulic grade, m. */
  head: number;
  /** Dynamic pressure head, m. */
  pressure: number;
  /** Static pressure head, m. Null for reservoirs and for nodes no reservoir reaches. */
  staticPressure: number | null;
  pressureFlag: LimitFlag | null;
  staticFlag: LimitFlag | null;
}

interface NodeValues {
  elevation: number;
  head: number;
  pressure: number;
}

function findFlag(
  issues: readonly CheckIssue[],
  elementType: 'node' | 'pipe',
  elementId: string,
  low: CheckIssue['check'] | null,
  high: CheckIssue['check'] | null,
): LimitFlag | null {
  for (const issue of issues) {
    if (issue.elementType !== elementType || issue.elementId !== elementId) continue;
    if (issue.check === low) return { kind: 'low', severity: issue.severity, limit: issue.limit };
    if (issue.check === high) return { kind: 'high', severity: issue.severity, limit: issue.limit };
  }
  return null;
}

/**
 * Ground elevation, hydraulic grade and pressure of a node. For a reservoir the ground
 * elevation is the one of the scenario and the pressure is the water level above it.
 */
function nodeValues(
  scenario: Scenario,
  evaluation: StageEvaluation,
  id: string,
): NodeValues | null {
  const result = evaluation.result.nodes[id];
  if (!result) return null;
  const reservoir = scenario.reservoirs.find((r) => r.id === id);
  if (reservoir) {
    return {
      elevation: reservoir.elevation,
      head: result.head,
      pressure: result.head - reservoir.elevation,
    };
  }
  return { elevation: result.elevation, head: result.head, pressure: result.pressure };
}

/**
 * Rows of the pipe table, in the order of the scenario. Limit flags come from the check
 * report, so they follow the checks that are active in the stage. Pipes without a result are
 * left out.
 */
export function pipeTableRows(scenario: Scenario, evaluation: StageEvaluation): PipeTableRow[] {
  const { issues } = evaluation.report;
  const rows: PipeTableRow[] = [];
  for (const pipe of scenario.pipes) {
    const result = evaluation.result.pipes[pipe.id];
    if (!result) continue;
    const reversed = result.flow < 0;
    const upstream = reversed ? pipe.to : pipe.from;
    const downstream = reversed ? pipe.from : pipe.to;
    const up = nodeValues(scenario, evaluation, upstream);
    const down = nodeValues(scenario, evaluation, downstream);
    if (!up || !down) continue;
    rows.push({
      id: pipe.id,
      upstream,
      downstream,
      reversed,
      length: pipe.length,
      flow: Math.abs(m3sToLps(result.flow)),
      dn: evaluation.diameters[pipe.id] ?? pipe.initialDN,
      velocity: Math.abs(result.velocity),
      unitHeadLoss: result.unitHeadLoss * 1000,
      headLoss: Math.abs(result.headLoss),
      headUp: up.head,
      headDown: down.head,
      elevationUp: up.elevation,
      elevationDown: down.elevation,
      pressureUp: up.pressure,
      pressureDown: down.pressure,
      velocityFlag: findFlag(issues, 'pipe', pipe.id, 'minVelocity', 'maxVelocity'),
      pressureUpFlag: findFlag(issues, 'node', upstream, 'minDynamicPressure', null),
      pressureDownFlag: findFlag(issues, 'node', downstream, 'minDynamicPressure', null),
    });
  }
  return rows;
}

/** Rows of the node table: reservoirs first, then the nodes in the order of the scenario. */
export function nodeTableRows(scenario: Scenario, evaluation: StageEvaluation): NodeTableRow[] {
  const { issues, staticPressure } = evaluation.report;
  const rows: NodeTableRow[] = [];
  for (const reservoir of scenario.reservoirs) {
    const values = nodeValues(scenario, evaluation, reservoir.id);
    if (!values) continue;
    rows.push({
      id: reservoir.id,
      kind: 'reservoir',
      ...values,
      demand: null,
      staticPressure: null,
      pressureFlag: null,
      staticFlag: null,
    });
  }
  for (const node of scenario.nodes) {
    const result = evaluation.result.nodes[node.id];
    if (!result) continue;
    rows.push({
      id: node.id,
      kind: 'node',
      elevation: result.elevation,
      demand: m3sToLps(result.demand),
      head: result.head,
      pressure: result.pressure,
      staticPressure: staticPressure[node.id] ?? null,
      pressureFlag: findFlag(issues, 'node', node.id, 'minDynamicPressure', null),
      staticFlag: findFlag(issues, 'node', node.id, null, 'maxStaticPressure'),
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Columns and CSV
// ---------------------------------------------------------------------------

export type PipeColumnKey = Exclude<
  keyof PipeTableRow,
  'reversed' | 'velocityFlag' | 'pressureUpFlag' | 'pressureDownFlag'
>;

export interface PipeColumn {
  key: PipeColumnKey;
  label: LocalizedText;
  /** Null for text columns. */
  unit: LocalizedText | null;
  /** Decimals shown. Null for text columns. */
  digits: number | null;
}

const same = (text: string): LocalizedText => ({ pt: text, en: text });
const METRE = same('m');
/** Pressure head unit: metres of water column. */
export const HEAD_UNIT: LocalizedText = { pt: 'mca', en: 'mca' };

/** Columns of the pipe table, in display order. The table and the CSV share them. */
export const PIPE_COLUMNS: readonly PipeColumn[] = [
  { key: 'id', label: { pt: 'Trecho', en: 'Pipe' }, unit: null, digits: null },
  { key: 'upstream', label: { pt: 'Nó montante', en: 'Upstream node' }, unit: null, digits: null },
  {
    key: 'downstream',
    label: { pt: 'Nó jusante', en: 'Downstream node' },
    unit: null,
    digits: null,
  },
  { key: 'length', label: { pt: 'Extensão', en: 'Length' }, unit: METRE, digits: 1 },
  { key: 'flow', label: { pt: 'Vazão', en: 'Flow' }, unit: same('L/s'), digits: 3 },
  { key: 'dn', label: same('DN'), unit: same('mm'), digits: 0 },
  { key: 'velocity', label: { pt: 'Velocidade', en: 'Velocity' }, unit: same('m/s'), digits: 2 },
  {
    key: 'unitHeadLoss',
    label: { pt: 'Perda de carga unitária J', en: 'Unit head loss J' },
    unit: same('m/km'),
    digits: 2,
  },
  {
    key: 'headLoss',
    label: { pt: 'Perda de carga no trecho', en: 'Head loss in the pipe' },
    unit: METRE,
    digits: 2,
  },
  {
    key: 'headUp',
    label: { pt: 'Cota piezométrica montante', en: 'Upstream hydraulic grade' },
    unit: METRE,
    digits: 2,
  },
  {
    key: 'headDown',
    label: { pt: 'Cota piezométrica jusante', en: 'Downstream hydraulic grade' },
    unit: METRE,
    digits: 2,
  },
  {
    key: 'elevationUp',
    label: { pt: 'Cota do terreno montante', en: 'Upstream ground elevation' },
    unit: METRE,
    digits: 2,
  },
  {
    key: 'elevationDown',
    label: { pt: 'Cota do terreno jusante', en: 'Downstream ground elevation' },
    unit: METRE,
    digits: 2,
  },
  {
    key: 'pressureUp',
    label: { pt: 'Pressão disponível montante', en: 'Upstream available pressure' },
    unit: HEAD_UNIT,
    digits: 2,
  },
  {
    key: 'pressureDown',
    label: { pt: 'Pressão disponível jusante', en: 'Downstream available pressure' },
    unit: HEAD_UNIT,
    digits: 2,
  },
];

/** Byte order mark: spreadsheet programs need it to read the file as UTF-8. */
export const CSV_BOM = '﻿';

const CSV_SEPARATOR: Record<Lang, string> = { pt: ';', en: ',' };

/** Field separator of the CSV for a language. */
export function csvSeparator(lang: Lang): string {
  return CSV_SEPARATOR[lang];
}

/** Quotes a field when it holds the separator, a quote or a line break. */
export function csvField(text: string, separator: string): string {
  if (text.includes(separator) || /["\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Fixed decimals without thousands separator: decimal comma in pt, point in en. */
export function csvNumber(value: number, digits: number, lang: Lang): string {
  if (!Number.isFinite(value)) return '';
  let text = value.toFixed(digits);
  if (Number(text) === 0) text = (0).toFixed(digits);
  return lang === 'pt' ? text.replace('.', ',') : text;
}

/**
 * Pipe table as CSV text: BOM, a header row with units and one line per pipe, lines ended by
 * CRLF. pt uses semicolon and decimal comma; en uses comma and decimal point.
 */
export function pipeTableCsv(rows: readonly PipeTableRow[], lang: Lang): string {
  const separator = csvSeparator(lang);
  const header = PIPE_COLUMNS.map((column) =>
    csvField(
      column.unit ? `${column.label[lang]} (${column.unit[lang]})` : column.label[lang],
      separator,
    ),
  );
  const lines = [header.join(separator)];
  for (const row of rows) {
    const cells = PIPE_COLUMNS.map((column) => {
      const value = row[column.key];
      return typeof value === 'number'
        ? csvField(csvNumber(value, column.digits ?? 2, lang), separator)
        : csvField(value, separator);
    });
    lines.push(cells.join(separator));
  }
  return CSV_BOM + lines.join('\r\n') + '\r\n';
}

export function csvFileName(stageId: string): string {
  return `aquatubos-${stageId}.csv`;
}
