import { useTr } from '../../i18n';
import { SCENARIOS } from '../../scenarios';
import { Dialog } from '../shell/Dialog';
import { aboutStrings, ORIGINAL_URL, REPO_URL } from './strings';

function ExternalLink({ href, children }: { href: string; children: string }) {
  const tr = useTr();
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="visually-hidden"> {tr(aboutStrings.newTab)}</span>
    </a>
  );
}

/** Credits: what the app is, where it comes from and what the calculations are based on. */
export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tr = useTr();
  return (
    <Dialog open={open} onClose={onClose} title={tr(aboutStrings.title)}>
      <div className="about">
        <p>{tr(aboutStrings.what(SCENARIOS.length))}</p>
        <p className="about__note">{tr(aboutStrings.disclaimer)}</p>

        <h3>{tr(aboutStrings.originHeading)}</h3>
        <p>
          {tr(aboutStrings.origin)}{' '}
          <ExternalLink href={ORIGINAL_URL}>{tr(aboutStrings.originLink)}</ExternalLink>
        </p>

        <h3>{tr(aboutStrings.basisHeading)}</h3>
        <ul>
          {aboutStrings.basis.map((item) => (
            <li key={item.en}>{tr(item)}</li>
          ))}
        </ul>

        <h3>{tr(aboutStrings.sourceHeading)}</h3>
        <p>
          {tr(aboutStrings.source)}{' '}
          <ExternalLink href={REPO_URL}>{tr(aboutStrings.sourceLink)}</ExternalLink>
        </p>
      </div>
    </Dialog>
  );
}
