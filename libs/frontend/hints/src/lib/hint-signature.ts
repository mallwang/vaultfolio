import type { Hint } from './hint.js';

function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export function hintSignature(
  hint: Pick<Hint, 'titleKey' | 'descriptionKey' | 'severity' | 'params'>,
): string {
  const canonical = {
    titleKey: hint.titleKey,
    descriptionKey: hint.descriptionKey,
    severity: hint.severity,
    params: hint.params ?? {},
  };
  const sorted = Object.fromEntries(
    Object.entries(canonical).sort(([a], [b]) => a.localeCompare(b)),
  );
  if (sorted['params'] && typeof sorted['params'] === 'object') {
    sorted['params'] = Object.fromEntries(
      Object.entries(sorted['params'] as Record<string, unknown>).sort(([a], [b]) =>
        a.localeCompare(b),
      ),
    ) as Record<string, string | number>;
  }
  return cyrb53(JSON.stringify(sorted)).toString(16);
}
