/**
 * Consent-gated Google Analytics 4. Nothing in this module makes a request until the visitor
 * opts in, and nothing here reads the calculator's fields or state.
 */

export type ConsentChoice = 'granted' | 'denied';
export interface ConsentRecord {
  choice: ConsentChoice;
  at: string;
  version: number;
}
type ConsentStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Gtag = (...args: unknown[]) => void;
type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: Gtag } & Record<string, unknown>;

export const consentStorageKey = 'japan-purchasing-power.analytics-consent';
/**
 * Increase when what analytics collects changes, so every visitor is asked again.
 * Keep the privacy notice in privacy.html in step with this version.
 */
export const consentVersion = 1;
/** A choice lasts a year, then the visitor is asked again. Analytics cookies never outlive it. */
export const consentMaxAgeDays = 365;
const dayMs = 86_400_000;
const measurementIdPattern = /^G-[A-Z0-9]{4,20}$/;
/**
 * Prefix for this app's analytics cookies. The app shares its origin with other sites on the
 * same domain, so the prefix keeps it from reading or deleting their `_ga` cookies.
 */
export const cookiePrefix = 'jppc';
/** Matches `jppc_ga` and `jppc_ga_<ID>`, plus the double-underscore form some gtag versions use. */
const ownCookiePattern = new RegExp(`^${cookiePrefix}__?ga(?:_[A-Za-z0-9]+)?$`);
/** Campaign tags describe where a visit came from; every other query parameter is dropped. */
const campaignParameters = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id'];

/** The configured GA4 measurement ID, or null when none (or an invalid one) is set at build time. */
export function measurementId(value: unknown = import.meta.env.VITE_GA_MEASUREMENT_ID): string | null {
  if (typeof value !== 'string') return null;
  const id = value.trim();
  return measurementIdPattern.test(id) ? id : null;
}

/** True when the browser sends Global Privacy Control or Do Not Track. Either one is treated as a decline. */
export function hasOptOutSignal(
  nav: { globalPrivacyControl?: unknown; doNotTrack?: unknown } = navigator,
  win: unknown = window,
): boolean {
  // Older Safari and Edge exposed Do Not Track on window instead of navigator.
  const legacyDoNotTrack = (win as { doNotTrack?: unknown } | null)?.doNotTrack;
  return nav.globalPrivacyControl === true || nav.doNotTrack === '1' || legacyDoNotTrack === '1';
}

/** Browser storage, or null when the browser blocks access to it. */
export function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Reads a stored choice. Unreadable, malformed, outdated-version, future-dated, or expired records count as no choice. */
export function readConsent(storage: ConsentStorage | null, now: number): ConsentRecord | null {
  if (!storage) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(consentStorageKey);
  } catch {
    return null;
  }
  if (raw === null) return null;
  let parsed: Partial<ConsentRecord> = {};
  try {
    parsed = (JSON.parse(raw) ?? {}) as Partial<ConsentRecord>;
  } catch {
    // Malformed JSON is discarded below like any other invalid record.
  }
  const { choice, at, version } = parsed;
  const time = typeof at === 'string' ? Date.parse(at) : Number.NaN;
  const valid = (choice === 'granted' || choice === 'denied') && version === consentVersion
    && Number.isFinite(time) && time <= now && now - time < consentMaxAgeDays * dayMs;
  if (valid) return { choice, at: at as string, version };
  try {
    storage.removeItem(consentStorageKey);
  } catch {
    // Nothing more to do; the record is ignored either way.
  }
  return null;
}

/** Stores the choice and its time. Returns false when storage is unavailable, so the choice lasts for this visit only. */
export function writeConsent(storage: ConsentStorage | null, choice: ConsentChoice, now: number): boolean {
  if (!storage) return false;
  try {
    const record: ConsentRecord = { choice, at: new Date(now).toISOString(), version: consentVersion };
    storage.setItem(consentStorageKey, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

/** The page address sent to Google: origin and path, plus campaign tags only. No fragment or other query parameters. */
export function pageLocation(href: string): string {
  const url = new URL(href);
  const kept = new URLSearchParams();
  for (const name of campaignParameters) {
    const value = url.searchParams.get(name);
    if (value !== null) kept.set(name, value);
  }
  const query = kept.toString();
  return `${url.origin}${url.pathname}${query ? `?${query}` : ''}`;
}

/**
 * Removes this app's prefixed analytics cookies, which are host-only and set at the app path.
 * Unprefixed `_ga` cookies belong to other sites on the same domain and are left alone.
 */
export function deleteAnalyticsCookies(doc: Document, basePath: string): void {
  const names = doc.cookie.split(';')
    .map((cookie) => cookie.split('=')[0].trim())
    .filter((name) => ownCookiePattern.test(name));
  for (const name of names) doc.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${basePath}`;
}

function scriptSelector(id: string) {
  return `script[data-analytics-id="${id}"]`;
}

/**
 * Loads gtag.js after consent. Advertising storage and signals stay off, the prefixed cookies
 * are limited to this host and app path, and the page address is reduced by pageLocation().
 */
export function startAnalytics(id: string, doc: Document = document, basePath: string = import.meta.env.BASE_URL): void {
  const win = doc.defaultView as unknown as AnalyticsWindow;
  win[`ga-disable-${id}`] = false;
  if (doc.querySelector(scriptSelector(id))) {
    win.gtag?.('consent', 'update', { analytics_storage: 'granted' });
    return;
  }
  const dataLayer = win.dataLayer ?? [];
  win.dataLayer = dataLayer;
  win.gtag = function gtag() {
    // gtag.js expects the arguments object itself, not an array copy.
    // eslint-disable-next-line prefer-rest-params
    dataLayer.push(arguments);
  };
  win.gtag('consent', 'default', {
    analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
  });
  win.gtag('js', new Date());
  win.gtag('config', id, {
    page_location: pageLocation(win.location.href),
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_domain: 'none',
    cookie_path: basePath,
    cookie_prefix: cookiePrefix,
    cookie_expires: consentMaxAgeDays * 86_400,
  });
  const script = doc.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  script.dataset.analyticsId = id;
  doc.head.append(script);
}

/** Stops collection immediately after a withdrawal and removes the analytics cookies. */
export function stopAnalytics(id: string, doc: Document = document, basePath: string = import.meta.env.BASE_URL): void {
  const win = doc.defaultView as unknown as AnalyticsWindow;
  // Google's documented opt-out flag; gtag.js checks it before sending each hit.
  win[`ga-disable-${id}`] = true;
  win.gtag?.('consent', 'update', { analytics_storage: 'denied' });
  deleteAnalyticsCookies(doc, basePath);
}
