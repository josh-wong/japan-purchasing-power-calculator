import { catalog, initLanguage } from './i18n';

initLanguage();

// Builds without a measurement ID drop this branch, so they contain no analytics code at all.
if (import.meta.env.VITE_GA_MEASUREMENT_ID) {
  void import('./consent-banner').then(({ initAnalyticsConsent }) => initAnalyticsConsent({
    linkToNotice: false, pageTitle: catalog('en').meta.privacyTitle,
  }));
}

export {};
