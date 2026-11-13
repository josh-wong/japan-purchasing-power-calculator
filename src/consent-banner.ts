import {
  browserStorage, deleteAnalyticsCookies, hasOptOutSignal, measurementId, readConsent,
  startAnalytics, stopAnalytics, writeConsent, type ConsentChoice,
} from './analytics';

interface ConsentOptions {
  /** Link to the privacy notice from the panel. The notice page itself turns this off. */
  linkToNotice?: boolean;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

const settingsHint = 'You can change this anytime with Analytics settings at the bottom of the page.';

/**
 * Shows the opt-in panel and the Analytics settings control, and starts analytics only after
 * the visitor allows it. Does nothing when no measurement ID was configured at build time.
 */
export function initAnalyticsConsent({ linkToNotice = true }: ConsentOptions = {}): void {
  const configuredId = measurementId();
  if (!configuredId) return;
  const id: string = configuredId;
  const basePath = import.meta.env.BASE_URL;
  const storage = browserStorage();
  const signal = hasOptOutSignal();
  let choice: ConsentChoice | null = signal ? null : readConsent(storage, Date.now())?.choice ?? null;

  if (choice === 'granted') startAnalytics(id);
  else deleteAnalyticsCookies(document, basePath);

  const announcer = element('p', { id: 'consent-announcement', className: 'sr-only' });
  announcer.setAttribute('role', 'status');
  const description = element('p', {},
    'With your permission, this site uses Google Analytics cookies to count visits and see which pages people use. ',
    'It never sends the amounts you enter or the options you choose.');
  if (linkToNotice) description.append(' ', element('a', { href: 'privacy.html' }, 'Read the privacy notice'));
  const status = element('p', { className: 'consent-status', hidden: true });
  const allow = element('button', { type: 'button', className: 'consent-button' }, 'Allow analytics');
  const decline = element('button', { type: 'button', className: 'consent-button' }, 'Decline');
  const close = element('button', { type: 'button', className: 'consent-button' }, 'Close');
  const panel = element('section', { id: 'analytics-consent', className: 'consent', hidden: true, tabIndex: -1 },
    element('div', { className: 'wrap consent-inner' },
      element('div', { className: 'consent-text' },
        element('p', { id: 'consent-title', className: 'consent-title' }, 'Usage analytics'),
        description, status),
      element('div', { className: 'consent-actions' }, allow, decline, close)));
  panel.setAttribute('aria-labelledby', 'consent-title');
  document.body.prepend(panel);
  document.body.append(announcer);

  const settings = element('button', { type: 'button', id: 'analytics-settings', className: 'link-button' }, 'Analytics settings');
  settings.setAttribute('aria-controls', panel.id);
  settings.setAttribute('aria-expanded', 'false');
  const footerLinks = document.getElementById('footer-links');
  if (footerLinks) footerLinks.append(' · ', settings);

  let returnFocus: HTMLElement | null = null;

  function show(fromSettings: boolean) {
    const current = signal
      ? 'Your browser is sending a Global Privacy Control or Do Not Track signal, so analytics stays off.'
      : choice === 'granted' ? 'Analytics is currently allowed.'
        : choice === 'denied' ? 'Analytics is currently off.' : '';
    status.textContent = current;
    status.hidden = !current;
    allow.hidden = signal;
    decline.hidden = signal;
    close.hidden = !signal;
    panel.hidden = false;
    settings.setAttribute('aria-expanded', 'true');
    if (fromSettings) {
      returnFocus = settings;
      panel.scrollIntoView?.({ block: 'start' });
      panel.focus();
    }
  }

  function hide() {
    const hadFocus = panel.contains(document.activeElement);
    panel.hidden = true;
    settings.setAttribute('aria-expanded', 'false');
    if (!hadFocus) return;
    const target = returnFocus ?? document.querySelector('h1');
    if (target && target !== settings) target.tabIndex = -1;
    target?.focus();
    returnFocus = null;
  }

  function announce(text: string) {
    announcer.textContent = '';
    // A fresh change after clearing lets screen readers repeat an identical message.
    setTimeout(() => { announcer.textContent = text; }, 50);
  }

  function choose(next: ConsentChoice) {
    choice = next;
    const stored = writeConsent(storage, next, Date.now());
    if (next === 'granted') startAnalytics(id);
    else stopAnalytics(id);
    hide();
    const scope = stored ? '' : ' for this visit';
    announce(`${next === 'granted' ? 'Analytics allowed' : 'Analytics off'}${scope}. ${settingsHint}`);
  }

  allow.addEventListener('click', () => choose('granted'));
  decline.addEventListener('click', () => choose('denied'));
  close.addEventListener('click', hide);
  settings.addEventListener('click', () => show(true));

  if (!signal && choice === null) show(false);
}
