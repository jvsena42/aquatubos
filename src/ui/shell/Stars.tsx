import { useTr } from '../../i18n';
import type { Stars as StarCount } from '../../game/types';
import { IconStar } from './icons';
import { shellStrings } from './strings';

/** Zero to three stars. Earned stars are filled, the others are outlines. */
export function Stars({ value }: { value: StarCount }) {
  const tr = useTr();
  return (
    <span className="stars" role="img" aria-label={tr(shellStrings.stars(value))}>
      {[1, 2, 3].map((n) => (
        <span key={n} className={n <= value ? 'stars__on' : 'stars__off'}>
          <IconStar filled={n <= value} />
        </span>
      ))}
    </span>
  );
}
