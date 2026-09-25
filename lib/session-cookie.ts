/** Parse the local session cookie, including cookies written by the older
    double-encoded implementation. */
export function parseSessionUserId(raw: string | null | undefined): string {
  let value = String(raw ?? '');
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const decoded = decodeURIComponent(value);
      if (decoded === value) break;
      value = decoded;
    } catch {
      break;
    }
  }

  try {
    const session = JSON.parse(value) as { user?: { id?: unknown } };
    const id = String(session.user?.id ?? '');
    return /^\d+$/.test(id) ? id : '';
  } catch {
    return '';
  }
}
