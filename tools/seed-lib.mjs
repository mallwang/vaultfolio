/** Shared helpers of the seed scripts: argument parsing and cookie sign-in. */

export function parseArgs(argv = process.argv.slice(2)) {
  return Object.fromEntries(
    argv.flatMap((a, i, all) => {
      if (!a.startsWith('--')) return [];
      const next = all[i + 1];
      return [[a.slice(2), next && !next.startsWith('--') ? next : true]];
    }),
  );
}

/** Signs in and returns the request headers (session cookie) for the REST API. */
export async function signIn(base, email, password) {
  if (!email || !password) throw new Error('--email and --password required');
  const res = await fetch(`${base}/auth/sign-in`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`sign-in failed: ${res.status}`);
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  return { 'content-type': 'application/json', cookie };
}
