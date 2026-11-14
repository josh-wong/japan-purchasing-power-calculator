// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { detectLocale, lookup } from './i18n';
import { consentMessages } from './i18n/consent';
import { en } from './i18n/en';
import { ja } from './i18n/ja';
import indexHtml from '../index.html?raw';
import privacyHtml from '../privacy.html?raw';

/** Every key path with the kind of value (text, or a function and its parameter count). */
function shape(value: unknown, path = ''): string[] {
  if (typeof value === 'function') return [`${path} fn/${value.length}`];
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, child]) => shape(child, path ? `${path}.${key}` : key));
  }
  return [`${path} ${typeof value}`];
}

const pages = [['index.html', indexHtml], ['privacy.html', privacyHtml]].map(([name, html]) => ({
  name,
  doc: new DOMParser().parseFromString(html, 'text/html'),
}));
const normalize = (text: string | null) => (text ?? '').replace(/\s+/g, ' ').trim();

describe('dictionaries', () => {
  it('give Japanese the same keys and message parameters as English', () => {
    expect(shape(ja).sort()).toEqual(shape(en).sort());
    expect(shape(consentMessages.ja).sort()).toEqual(shape(consentMessages.en).sort());
  });

  it('leave no Japanese entry empty or untranslated', () => {
    const texts = (value: unknown): string[] => typeof value === 'string' ? [value]
      : typeof value === 'object' && value !== null ? Object.values(value).flatMap(texts) : [];
    const english = new Set(texts(en));
    for (const text of texts(ja)) {
      // The Japanese announcement joins sentences without a separator.
      if (text === ja.announcement.separator) continue;
      expect(text.trim()).not.toBe('');
      expect(english.has(text) && /[a-z]{4}/i.test(text), `untranslated: ${text}`).toBe(false);
    }
  });
});

describe('detectLocale', () => {
  it.each([
    [['ja'], 'ja'], [['ja-JP', 'en'], 'ja'], [['JA-jp'], 'ja'], [['en-US', 'ja'], 'en'], [['fr'], 'en'], [[], 'en'], [['jav'], 'en'],
  ])('maps %j to %s', (languages, expected) => {
    expect(detectLocale(languages)).toBe(expected);
  });
});

describe.each(pages)('$name markup', ({ doc }) => {
  it('uses keys that exist in both languages and match the English text in the page', () => {
    const texts = Array.from(doc.querySelectorAll<HTMLElement>('[data-i18n]'));
    expect(texts.length).toBeGreaterThan(0);
    for (const element of texts) {
      const key = element.dataset.i18n!;
      expect(lookup(ja, key), key).toBeTypeOf('string');
      expect(normalize(element.textContent), key).toBe(lookup(en, key));
    }
    for (const element of Array.from(doc.querySelectorAll<HTMLElement>('[data-i18n-rich]'))) {
      const key = element.dataset.i18nRich!;
      const copy = element.cloneNode(true) as HTMLElement;
      for (const slot of Array.from(copy.querySelectorAll<HTMLElement>('[data-slot]'))) slot.replaceWith(`{${slot.dataset.slot}}`);
      expect(normalize(copy.textContent), key).toBe(lookup(en, key));
      for (const slot of Array.from(element.querySelectorAll<HTMLElement>('[data-slot]'))) {
        expect(lookup(ja, key), key).toContain(`{${slot.dataset.slot}}`);
      }
    }
    for (const element of Array.from(doc.querySelectorAll<HTMLElement>('[data-i18n-attr]'))) {
      for (const pair of element.dataset.i18nAttr!.split(/\s+/)) {
        const [attribute, key] = pair.split('=');
        expect(lookup(ja, key), key).toBeTypeOf('string');
        expect(element.getAttribute(attribute), key).toBe(lookup(en, key));
      }
    }
  });

  it('offers English and Japanese in the language control, each named in its own language', () => {
    const options = Array.from(doc.querySelectorAll<HTMLOptionElement>('#language option'));
    expect(options.map((option) => [option.value, option.lang, option.textContent])).toEqual([['en', 'en', 'English'], ['ja', 'ja', '日本語']]);
  });
});

describe('privacy notice', () => {
  const { doc } = pages[1];
  const english = doc.querySelector<HTMLElement>('[data-locale="en"]')!;
  const japanese = doc.querySelector<HTMLElement>('[data-locale="ja"]')!;

  it('has an English and a Japanese version with the same structure', () => {
    expect(english.lang).toBe('en');
    expect(japanese.lang).toBe('ja');
    expect(japanese.hidden).toBe(true);
    for (const selector of ['h1', 'h2', 'p', 'li', 'tr', 'code', 'strong', 'a']) {
      expect(japanese.querySelectorAll(selector).length, selector).toBe(english.querySelectorAll(selector).length);
    }
  });

  it('links to the same destinations and names the same cookies in both versions', () => {
    const targets = (root: HTMLElement) => Array.from(root.querySelectorAll('a'), (link) => link.getAttribute('href')!.replace(/\?hl=ja$/, ''));
    expect(targets(japanese)).toEqual(targets(english));
    const codes = (root: HTMLElement) => Array.from(root.querySelectorAll('code'), (code) => code.textContent);
    expect(codes(japanese)).toEqual(codes(english));
  });
});
