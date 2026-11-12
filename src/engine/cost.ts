import type { CatalogPipe } from './types';

/** Commercial pipes, ascending by DN. Loaded from data/pipeCatalog.json. */
export const PIPE_CATALOG: readonly CatalogPipe[] = [];

/** Nominal diameters available to the player, mm, ascending. */
export const COMMERCIAL_DNS: readonly number[] = [];

/** Catalog entry for a DN in mm. Throws for a DN that is not in the catalog. */
export function catalogEntry(_dn: number): CatalogPipe {
  throw new Error('not implemented');
}

/** Cost of one pipe, R$. */
export function pipeCost(_dn: number, _length: number): number {
  throw new Error('not implemented');
}

/** Total cost of a set of pipes, R$. */
export function networkCost(_pipes: readonly { dn: number; length: number }[]): number {
  throw new Error('not implemented');
}
