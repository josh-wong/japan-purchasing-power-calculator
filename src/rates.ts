import { validateSnapshot, type RateSnapshot } from './rate-snapshot';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'json'>>;

/** Resolves the same-origin rates asset against Vite's base URL (root or project Pages path). */
export function ratesUrl(baseUrl: string = import.meta.env.BASE_URL): string {
  return `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}rates.json`;
}

/**
 * Loads the validated snapshot, or null when the asset is missing, unreachable,
 * malformed, or fails validation. The request carries no user input.
 */
export async function loadRates(
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
  baseUrl: string = import.meta.env.BASE_URL,
): Promise<RateSnapshot | null> {
  try {
    const response = await fetchImpl(ratesUrl(baseUrl), { cache: 'no-cache', credentials: 'same-origin' });
    if (!response.ok) return null;
    return validateSnapshot(await response.json());
  } catch {
    return null;
  }
}
