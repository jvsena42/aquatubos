import catalog from './data/pipeCatalog.json';
import type { CatalogPipe } from './types';

/**
 * Commercial pipes, ascending by DN. Loaded from data/pipeCatalog.json.
 * The prices are illustrative reference values, not actual SINAPI prices (see the note in the
 * JSON file).
 */
export const PIPE_CATALOG: readonly CatalogPipe[] = Object.freeze(
  (catalog.pipes as readonly CatalogPipe[])
    .map((pipe) => Object.freeze({ ...pipe }))
    .sort((a, b) => a.dn - b.dn),
);

/** Note that travels with the catalog: the prices are illustrative. */
export const PIPE_CATALOG_NOTE: string = catalog.note;

/** Currency of `pricePerMeter` (ISO 4217). */
export const PIPE_CATALOG_CURRENCY: string = catalog.currency;

/** Nominal diameters available to the player, mm, ascending. */
export const COMMERCIAL_DNS: readonly number[] = Object.freeze(PIPE_CATALOG.map((p) => p.dn));

/** Catalog entry for a DN in mm. Throws for a DN that is not in the catalog. */
export function catalogEntry(dn: number): CatalogPipe {
  const entry = PIPE_CATALOG.find((p) => p.dn === dn);
  if (!entry) {
    throw new Error(
      `DN ${dn} is not in the pipe catalog (available: ${COMMERCIAL_DNS.join(', ')})`,
    );
  }
  return entry;
}

const roundToCents = (value: number): number => Math.round(value * 100) / 100;

/** Cost of one pipe, R$: price per metre of the DN times the length (m), rounded to cents. */
export function pipeCost(dn: number, length: number): number {
  if (!Number.isFinite(length) || length < 0) {
    throw new RangeError(`pipe length must be a non-negative number, got ${length}`);
  }
  return roundToCents(catalogEntry(dn).pricePerMeter * length);
}

/** Total cost of a set of pipes, R$. */
export function networkCost(pipes: readonly { dn: number; length: number }[]): number {
  return roundToCents(pipes.reduce((total, pipe) => total + pipeCost(pipe.dn, pipe.length), 0));
}
