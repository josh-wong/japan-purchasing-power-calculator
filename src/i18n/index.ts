import { en, type Messages } from './en';
import { ja } from './ja';

// The display language. It starts from the browser's preferred language and stays in memory for
// the visit: it is never stored, put in the address, or sent anywhere.
export type Locale = 'en' | 'ja';

const catalogs: Record<Locale, Messages> = { en, ja };
const intlLocales: Record<Locale, string> = { en: 'en-US', ja: 'ja-JP' };

/** Dispatched on `document` after the page text changes language. public/theme.js listens too. */
export const localeChangeEvent = 'yenlens:localechange';

let current: Locale = 'en';
const listeners = new Set<() => void>();

/** Japanese when the first preferred language is Japanese, otherwise English. */
export function detectLocale(languages: readonly string[]): Locale {
  return languages[0]?.trim().toLowerCase().split('-')[0] === 'ja' ? 'ja' : 'en';
}

function browserLanguages(): readonly string[] {
  try {
    if (navigator.languages?.length) return navigator.languages;
    return navigator.language ? [navigator.language] : [];
  } catch {
    return [];
  }
}

export function locale(): Locale {
  return current;
}

export function messages(): Messages {
  return catalogs[current];
}

export function catalog(target: Locale): Messages {
  return catalogs[target];
}

/** The locale passed to Intl formatters, so numbers and dates follow the selected language. */
export function intlLocale(): string {
  return intlLocales[current];
}

/** Resolves a dotted key such as `form.title` to a string, or undefined for a missing or non-text entry. */
export function lookup(source: Messages, key: string): string | undefined {
  let value: unknown = source;
  for (const part of key.split('.')) {
    value = typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[part] : undefined;
  }
  return typeof value === 'string' ? value : undefined;
}

const slotCache = new WeakMap<Element, Map<string, Element>>();

function slotsOf(element: Element) {
  let slots = slotCache.get(element);
  if (!slots) {
    slots = new Map(Array.from(element.querySelectorAll<HTMLElement>('[data-slot]'), (slot) => [slot.dataset.slot!, slot]));
    slotCache.set(element, slots);
  }
  return slots;
}

/**
 * Applies the selected language to static markup:
 * - `data-i18n="key"` replaces the text.
 * - `data-i18n-rich="key"` replaces the text around child elements marked `data-slot="name"`,
 *   which the message places with `{name}`, so links keep their attributes.
 * - `data-i18n-attr="attribute=key ..."` sets attributes such as aria-label.
 * - `data-locale="en|ja"` shows a block written in one language only and hides the others.
 */
export function applyStaticText(root: Document = document): void {
  const text = messages();
  root.documentElement.lang = current;
  for (const element of Array.from(root.querySelectorAll<HTMLElement>('[data-i18n]'))) {
    const value = lookup(text, element.dataset.i18n!);
    if (value !== undefined) element.textContent = value;
  }
  for (const element of Array.from(root.querySelectorAll<HTMLElement>('[data-i18n-rich]'))) {
    const value = lookup(text, element.dataset.i18nRich!);
    if (value === undefined) continue;
    const slots = slotsOf(element);
    element.replaceChildren(...value.split(/(\{\w+\})/).filter(Boolean).map((part) => {
      const name = /^\{(\w+)\}$/.exec(part)?.[1];
      return (name && slots.get(name)) || part;
    }));
  }
  for (const element of Array.from(root.querySelectorAll<HTMLElement>('[data-i18n-attr]'))) {
    for (const pair of element.dataset.i18nAttr!.split(/\s+/).filter(Boolean)) {
      const [attribute, key] = pair.split('=');
      const value = lookup(text, key);
      if (value !== undefined) element.setAttribute(attribute, value);
    }
  }
  for (const element of Array.from(root.querySelectorAll<HTMLElement>('[data-locale]'))) {
    element.hidden = element.dataset.locale !== current;
  }
}

export function setLocale(next: Locale): void {
  if (next === current) return;
  current = next;
  applyStaticText();
  const control = document.getElementById('language') as HTMLSelectElement | null;
  if (control) control.value = current;
  for (const listener of listeners) listener();
  document.dispatchEvent(new CustomEvent(localeChangeEvent, { detail: { locale: current } }));
}

/** Runs the listener after each language switch, once the static text has changed. */
export function onLocaleChange(listener: () => void): void {
  listeners.add(listener);
}

/** Picks the starting language, applies it to the page, and wires the header language control. */
export function initLanguage(): void {
  current = detectLocale(browserLanguages());
  applyStaticText();
  const control = document.getElementById('language') as HTMLSelectElement | null;
  if (control) {
    control.value = current;
    control.addEventListener('change', () => setLocale(control.value === 'ja' ? 'ja' : 'en'));
  }
  document.dispatchEvent(new CustomEvent(localeChangeEvent, { detail: { locale: current } }));
}
