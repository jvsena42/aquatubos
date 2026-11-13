import type { Selection } from '../../state/store';
import type { Vec3 } from './geometry';
import type { SceneModel } from './model';

export type LabelKind = 'node' | 'pipe' | 'reservoir' | 'pump';

export interface Label {
  id: string;
  /** World position of the anchor (bottom centre of the label). */
  position: Vec3;
  /** Id of the pipe, node or reservoir the label belongs to. */
  element: string;
  kind: LabelKind;
  text: string;
  /** Shorter text used on a small screen when the full one would overlap another label. */
  short?: string;
  /** Which label stays when two would overlap on a small screen. Higher stays. */
  priority: number;
}

/** Texts of the labels, already translated and formatted. */
export interface LabelTexts {
  pipe: (dn: number) => string;
  /** Full node label, with the unit. */
  node: (id: string, pressure: number | null) => string;
  /** Node label for small screens: the pressure without the unit. */
  nodeCompact: (id: string, pressure: number | null) => string;
  reservoir: (id: string, waterLevel: number) => string;
  pump: (id: string) => string;
}

export interface LabelOptions {
  /** Small screen: fewer and shorter labels. */
  compact: boolean;
  selection: Selection;
  /** Node with the lowest pressure: its label outranks the other nodes. */
  criticalId?: string | null;
}

export const LABEL_PRIORITY = {
  selected: 5,
  critical: 4,
  reservoir: 3.5,
  pump: 3,
  node: 2,
  pipe: 1,
} as const;

/**
 * Labels of the scene. On a wide screen every element has its full label. On a small screen
 * (`compact`) there is no room for that at 360 px: pipes are labelled only when selected (their
 * thickness and colour already show DN and velocity), nodes show id and pressure without the
 * unit (or the id alone where labels would overlap), and reservoirs and pumps show their id. The selected element always has its full label,
 * so nothing is lost: tap an element to read it.
 */
export function buildLabels(model: SceneModel, texts: LabelTexts, options: LabelOptions): Label[] {
  const { compact, selection, criticalId } = options;
  const isSelected = (kind: LabelKind, id: string) =>
    selection?.type === kind && selection.id === id;
  const labels: Label[] = [];

  for (const pipe of model.pipes) {
    const selected = isSelected('pipe', pipe.id);
    if (compact && !selected) continue;
    const middle = pipe.path[Math.floor(pipe.path.length / 2)] ?? { x: 0, y: 0, z: 0 };
    labels.push({
      id: `pipe-${pipe.id}`,
      element: pipe.id,
      kind: 'pipe',
      position: { ...middle, y: middle.y + pipe.radius * 2 },
      text: compact ? `${pipe.id} · ${texts.pipe(pipe.dn)}` : texts.pipe(pipe.dn),
      priority: selected ? LABEL_PRIORITY.selected : LABEL_PRIORITY.pipe,
    });
  }

  for (const node of model.nodes) {
    const selected = isSelected('node', node.id);
    labels.push({
      id: `node-${node.id}`,
      element: node.id,
      kind: 'node',
      position: { ...node.position, y: node.position.y + node.radius * 1.6 },
      text:
        compact && !selected
          ? texts.nodeCompact(node.id, node.pressure)
          : texts.node(node.id, node.pressure),
      // Where even that does not fit, the id alone; the colour of the node shows its status.
      ...(compact && !selected && node.pressure !== null ? { short: node.id } : {}),
      priority: selected
        ? LABEL_PRIORITY.selected
        : node.id === criticalId
          ? LABEL_PRIORITY.critical
          : LABEL_PRIORITY.node,
    });
  }

  for (const reservoir of model.reservoirs) {
    const selected = isSelected('reservoir', reservoir.id);
    labels.push({
      id: `reservoir-${reservoir.id}`,
      element: reservoir.id,
      kind: 'reservoir',
      position: { ...reservoir.position, y: reservoir.topY },
      text:
        compact && !selected ? reservoir.id : texts.reservoir(reservoir.id, reservoir.waterLevel),
      priority: selected ? LABEL_PRIORITY.selected : LABEL_PRIORITY.reservoir,
    });
  }

  for (const pump of model.pumps) {
    const selected = isSelected('pump', pump.id);
    labels.push({
      id: `pump-${pump.id}`,
      element: pump.id,
      kind: 'pump',
      position: { ...pump.marker.position, y: pump.marker.position.y + pump.radius * 8 },
      text: compact && !selected ? pump.id : texts.pump(pump.id),
      priority: selected ? LABEL_PRIORITY.selected : LABEL_PRIORITY.pump,
    });
  }

  return labels;
}
