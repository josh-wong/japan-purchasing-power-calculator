import {
  browserStorage, clearConsent, consentMaxAgeDays, consentSecondsLeft, deleteAnalyticsCookies, hasOptOutSignal, measurementId, readConsent,
  startAnalytics, stopAnalytics, writeConsent, type ConsentChoice,
} from './analytics';
import { locale, onLocaleChange } from './i18n';
import { consentMessages } from './i18n/consent';

interface ConsentOptions {
  /** Link to the privacy notice from the panel. The notice page itself turns this off. */
  linkToNotice?: boolean;
  /** The English page title sent to Google in place of the translated document title. */
  pageTitle: string;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

const text = () => consentMessages[locale()];

/**
 * Shows the opt-in panel and the Analytics settings control, and starts analytics only after
 * the visitor allows it. Does nothing when no measurement ID was configured at build time.
 */
export function initAnalyticsConsent({ linkToNotice = true, pageTitle }: ConsentOptions): void {
  const configuredId = measurementId();
  if (!configuredId) return;
  const id: string = configuredId;
  const basePath = import.meta.env.BASE_URL;
  const storage = browserStorage();
  const signal = hasOptOutSignal();
  // A privacy signal overrides any earlier choice. Forget it, so turning the signal off later
  // asks again instead of silently resuming an old opt-in.
  if (signal) clearConsent(storage);
  const record = signal ? null : readConsent(storage, Date.now());
  let choice: ConsentChoice | null = record?.choice ?? null;

  if (record?.choice === 'granted') startAnalytics(id, consentSecondsLeft(record.at, Date.now()), document, basePath, pageTitle);
  else deleteAnalyticsCookies(document, basePath);

  const announcer = element('p', { id: 'consent-announcement', className: 'sr-only' });
  announcer.setAttribute('role', 'status');
  const title = element('p', { id: 'consent-title', className: 'consent-title' });
  const description = element('p');
  const status = element('p', { className: 'consent-status', hidden: true });
  const allow = element('button', { type: 'button', className: 'consent-button' });
  const decline = element('button', { type: 'button', className: 'consent-button' });
  const close = element('button', { type: 'button', className: 'consent-button' });
  const panel = element('section', { id: 'analytics-consent', className: 'consent', hidden: true, tabIndex: -1 },
    element('div', { className: 'wrap consent-inner' },
      element('div', { className: 'consent-text' }, title, description, status),
      element('div', { className: 'consent-actions' }, allow, decline, close)));
  panel.setAttribute('aria-labelledby', 'consent-title');
  document.body.prepend(panel);
  document.body.append(announcer);

  const settings = element('button', { type: 'button', id: 'analytics-settings', className: 'link-button' });
  settings.setAttribute('aria-controls', panel.id);
  settings.setAttribute('aria-expanded', 'false');
  const footerLinks = document.getElementById('footer-links');
  if (footerLinks) footerLinks.append(' · ', settings);

  let returnFocus: HTMLElement | null = null;

  function showStatus() {
    const messages = text();
    const current = signal ? messages.statusSignal
      : choice === 'granted' ? messages.statusAllowed
        : choice === 'denied' ? messages.statusOff : '';
    status.textContent = current;
    status.hidden = !current;
  }

  // Runs again when the visitor switches language, so an open panel follows the page.
  function showText() {
    const messages = text();
    title.textContent = messages.title;
    description.replaceChildren(messages.description);
    if (linkToNotice) description.append(' ', element('a', { href: 'privacy.html' }, messages.readNotice));
    allow.textContent = messages.allow;
    decline.textContent = messages.decline;
    close.textContent = messages.close;
    settings.textContent = messages.settings;
    showStatus();
  }

  showText();
  onLocaleChange(showText);

  function show(fromSettings: boolean) {
    showStatus();
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
    // The privacy notice holds one heading per language; only the shown one can take focus.
    const target = returnFocus ?? Array.from(document.querySelectorAll('h1')).find((heading) => !heading.closest('[hidden]')) ?? null;
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
    // A stored choice lasts the full period, and so do the cookies. A choice that couldn't be
    // stored lasts this visit only, so the cookies become session cookies.
    if (next === 'granted') startAnalytics(id, stored ? consentMaxAgeDays * 86_400 : 0, document, basePath, pageTitle);
    else stopAnalytics(id);
    hide();
    announce(text().confirmation(next === 'granted', stored));
  }

  allow.addEventListener('click', () => choose('granted'));
  decline.addEventListener('click', () => choose('denied'));
  close.addEventListener('click', hide);
  settings.addEventListener('click', () => show(true));

  if (!signal && choice === null) show(false);
}
