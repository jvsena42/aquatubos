import { useTr } from '../../i18n';
import { Dialog } from '../shell/Dialog';
import { aboutStrings, homeStrings, ORIGINAL_URL, REPO_URL } from './strings';

function ExternalLink({ href, children }: { href: string; children: string }) {
  const tr = useTr();
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="visually-hidden"> {tr(aboutStrings.newTab)}</span>
    </a>
  );
}

/** Credits as a short list: what the app is, what it is based on and where the code is. */
export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tr = useTr();
  return (
    <Dialog open={open} onClose={onClose} title={tr(aboutStrings.title)}>
      <div className="about">
        <p>{tr(aboutStrings.what)}</p>
        <p className="about__note">{tr(aboutStrings.disclaimer)}</p>
        <ul>
          <li>{tr(homeStrings.lead)}</li>
          {aboutStrings.basis.map((item) => (
            <li key={item.en}>{tr(item)}</li>
          ))}
          <li>{tr(homeStrings.saved)}</li>
          <li>
            {tr(aboutStrings.origin)}{' '}
            <ExternalLink href={ORIGINAL_URL}>{tr(aboutStrings.originLink)}</ExternalLink>
          </li>
          <li>
            {tr(aboutStrings.source)}{' '}
            <ExternalLink href={REPO_URL}>{tr(aboutStrings.sourceLink)}</ExternalLink>
          </li>
        </ul>
      </div>
    </Dialog>
  );
}
