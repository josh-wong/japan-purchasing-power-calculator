/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** GA4 measurement ID injected at build time. Unset in forks and local builds, which disables analytics. */
  readonly VITE_GA_MEASUREMENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
