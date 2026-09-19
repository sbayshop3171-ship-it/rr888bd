/** Persistence for the admin's site settings — cashier limits and support
    handles. Stored as overrides on top of SITE_SETTINGS_DEFAULTS, so a
    missing key always falls back to what the code shipped with. */

import { mkdir, readFile } from 'node:fs/promises';
import { writeFileAtomic } from './atomic-write';
import path from 'node:path';
import {
  isSupportEmail,
  isSupportUrl,
  mergeSiteSettings,
  SITE_SETTINGS_DEFAULTS,
  type ChannelLimit,
  type SettingsMutationResult,
  type SiteSettings,
} from './site-settings';

type SettingsStore = {
  version: 1;
  settings: Partial<SiteSettings>;
};

const STORE_FILE = path.join(process.cwd(), '.data', 'site-settings.json');

let writeQueue = Promise.resolve();

export async function getSiteSettings(): Promise<SiteSettings> {
  return merge((await readStore()).settings);
}

/**
 * Apply a partial update. Every limit is checked (positive, min ≤ max, a
 * known channel) and every support handle must be a web link; on the first
 * bad field nothing is written.
 */
export async function updateSiteSettings(patch: unknown): Promise<SettingsMutationResult> {
  const clean = normalize(patch);
  if (!clean.ok) return clean;

  return mutateStore((store) => {
    const current = merge(store.settings);
    const next: SiteSettings = mergeSiteSettings({
      ...current,
      ...clean.value,
      deposit: { ...current.deposit, ...clean.value.deposit },
      withdraw: { ...current.withdraw, ...clean.value.withdraw },
      support: { ...current.support, ...clean.value.support },
      notice: clean.value.notice ?? current.notice,
      flashApp: {
        ...current.flashApp,
        ...clean.value.flashApp,
        screenshots: clean.value.flashApp?.screenshots ?? current.flashApp.screenshots,
      },
      updatedAt: new Date().toISOString(),
    });
    store.settings = next;
    return { ok: true, settings: next };
  });
}

type Clean =
  | { ok: true; value: Partial<SiteSettings> }
  | Extract<SettingsMutationResult, { ok: false }>;

function normalize(input: unknown): Clean {
  const record = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const value: Partial<SiteSettings> = {};

  if (record.deposit && typeof record.deposit === 'object') {
    const out: Record<string, ChannelLimit> = {};
    for (const [id, raw] of Object.entries(record.deposit as Record<string, unknown>)) {
      if (!(id in SITE_SETTINGS_DEFAULTS.deposit)) return { ok: false, reason: 'unknown-channel', field: id };
      const lim = (raw ?? {}) as Record<string, unknown>;
      const base = SITE_SETTINGS_DEFAULTS.deposit[id];
      const min = money(lim.min, base.min);
      const max = money(lim.max, base.max);
      if (min === null || max === null || min > max) return { ok: false, reason: 'invalid-limit', field: id };
      out[id] = { min, max, active: lim.active === undefined ? base.active : Boolean(lim.active) };
    }
    value.deposit = out;
  }

  if (record.withdraw && typeof record.withdraw === 'object') {
    const w = record.withdraw as Record<string, unknown>;
    const min = money(w.min, SITE_SETTINGS_DEFAULTS.withdraw.min);
    const max = money(w.max, SITE_SETTINGS_DEFAULTS.withdraw.max);
    if (min === null || max === null || min > max) return { ok: false, reason: 'invalid-limit', field: 'withdraw' };
    value.withdraw = { min, max };
  }

  if (record.support && typeof record.support === 'object') {
    const s = record.support as Record<string, unknown>;
    const out: Partial<SiteSettings['support']> = {};
    for (const key of ['whatsapp', 'telegram', 'facebook'] as const) {
      if (s[key] === undefined) continue;
      const url = String(s[key]).trim().slice(0, 300);
      if (!isSupportUrl(url)) return { ok: false, reason: 'invalid-url', field: key };
      out[key] = url;
    }
    if (s.email !== undefined) {
      const email = String(s.email).trim().slice(0, 120);
      if (!isSupportEmail(email)) return { ok: false, reason: 'invalid-email', field: 'email' };
      out.email = email;
    }
    value.support = out as SiteSettings['support'];
  }

  if (record.notice !== undefined) value.notice = String(record.notice).trim().slice(0, 200);

  if (record.flashApp && typeof record.flashApp === 'object') {
    const f = record.flashApp as Record<string, unknown>;
    const nextFlash = {
      appName: typeof f.appName === 'string' ? String(f.appName).trim().slice(0, 40) || SITE_SETTINGS_DEFAULTS.flashApp.appName : SITE_SETTINGS_DEFAULTS.flashApp.appName,
      shortName: typeof f.shortName === 'string' ? String(f.shortName).trim().slice(0, 40) || SITE_SETTINGS_DEFAULTS.flashApp.shortName : SITE_SETTINGS_DEFAULTS.flashApp.shortName,
      tagline: typeof f.tagline === 'string' ? String(f.tagline).trim().slice(0, 80) || SITE_SETTINGS_DEFAULTS.flashApp.tagline : SITE_SETTINGS_DEFAULTS.flashApp.tagline,
      logoUrl: typeof f.logoUrl === 'string' ? String(f.logoUrl).trim().slice(0, 300) || SITE_SETTINGS_DEFAULTS.flashApp.logoUrl : SITE_SETTINGS_DEFAULTS.flashApp.logoUrl,
      screenshots: Array.isArray(f.screenshots)
        ? f.screenshots.filter((item): item is string => typeof item === 'string').map((url) => url.trim()).filter(Boolean).slice(0, 12)
        : SITE_SETTINGS_DEFAULTS.flashApp.screenshots,
    };
    value.flashApp = nextFlash;
  }

  return { ok: true, value };
}

/** A taka amount from untrusted input; undefined keeps the fallback. */
function money(raw: unknown, fallback: number): number | null {
  if (raw === undefined || raw === '') return fallback;
  const n = Math.round(Number(raw));
  return Number.isFinite(n) && n >= 0 && n <= 100_000_000 ? n : null;
}

function merge(partial: Partial<SiteSettings>): SiteSettings {
  return mergeSiteSettings(partial);
}

function mutateStore<T>(fn: (store: SettingsStore) => T): Promise<T> {
  const next = writeQueue.then(async () => {
    const store = await readStore();
    const result = fn(store);
    await writeStore(store);
    return result;
  });
  writeQueue = next.then(() => undefined, () => undefined);
  return next;
}

async function readStore(): Promise<SettingsStore> {
  try {
    const parsed = JSON.parse(await readFile(STORE_FILE, 'utf8')) as SettingsStore;
    if (parsed?.version === 1 && parsed.settings && typeof parsed.settings === 'object') return parsed;
  } catch {
    // nothing saved yet — the defaults apply
  }
  return { version: 1, settings: {} };
}

async function writeStore(store: SettingsStore) {
  await mkdir(path.dirname(STORE_FILE), { recursive: true });
  await writeFileAtomic(STORE_FILE, `${JSON.stringify(store, null, 2)}\n`);
}
