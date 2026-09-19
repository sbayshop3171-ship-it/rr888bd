/** Operator-tunable site settings: cashier limits and support handles.

    These used to be constants in lib/payments.ts and lib/brand.ts. The
    defaults below are those same values, so a fresh install behaves exactly
    as before; the admin panel writes overrides into .data/ (see
    site-settings-store.ts) and both the site and the admin screens read the
    merged result. Pure — no node imports — so client components can use it. */

import { BRAND } from './brand';
import { DEPOSIT_CHANNELS } from './payments';

export type ChannelLimit = {
  /** taka */
  min: number;
  max: number;
  /** a switched-off channel is hidden from the deposit screen */
  active: boolean;
};

export type SiteSettingsFlashApp = {
  appName: string;
  shortName: string;
  tagline: string;
  logoUrl: string;
  screenshots: string[];
};

export type SiteSettings = {
  /** per deposit channel, keyed by lib/payments channel id */
  deposit: Record<string, ChannelLimit>;
  withdraw: {
    min: number;
    max: number;
  };
  support: {
    whatsapp: string;
    telegram: string;
    facebook: string;
    /** shown in the footer and on the support page */
    email: string;
  };
  /** the running line under the header; empty hides it */
  notice: string;
  flashApp: SiteSettingsFlashApp;
  updatedAt: string | null;
};

export const DEFAULT_FLASH_APP_SCREENSHOTS = [
  'https://www.j188.app/siteadmin/upload/img/2043998029139099649.avif',
  'https://www.j188.app/siteadmin/upload/img/2043998068572270593.avif',
  'https://www.j188.app/siteadmin/upload/img/2043998101773058049.avif',
  'https://www.j188.app/siteadmin/upload/img/2043998134221434882.avif',
];

export const SITE_SETTINGS_DEFAULTS: SiteSettings = {
  deposit: Object.fromEntries(
    DEPOSIT_CHANNELS.map((c) => [c.id, { min: c.min, max: c.max, active: true }]),
  ),
  withdraw: { min: 500, max: 50_000 },
  support: {
    whatsapp: BRAND.social.whatsapp,
    telegram: BRAND.social.telegram,
    facebook: BRAND.social.facebook,
    email: BRAND.email,
  },
  notice: '',
  flashApp: {
    appName: 'RR888',
    shortName: 'RR888BD',
    tagline: 'প্লে প্রোটেক্ট দ্বারা নিশ্চিত',
    logoUrl: '/download-app-icon.png?v=apps-logo-20260914',
    screenshots: DEFAULT_FLASH_APP_SCREENSHOTS,
  },
  updatedAt: null,
};

export type SettingsMutationReason =
  | 'invalid-limit'
  | 'invalid-url'
  | 'invalid-email'
  | 'unknown-channel';

export type SettingsMutationResult =
  | { ok: true; settings: SiteSettings }
  | { ok: false; reason: SettingsMutationReason; field?: string };

/** Only web links, so a typo can't turn a support button into javascript:. */
export const isSupportUrl = (value: string) =>
  value === '' || /^https?:\/\/[^\s]+$/i.test(value);

/** Blank drops the email row; otherwise it has to look like an address. */
export const isSupportEmail = (value: string) =>
  value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export function mergeSiteSettings(partial: Partial<SiteSettings>): SiteSettings {
  return {
    deposit: { ...SITE_SETTINGS_DEFAULTS.deposit, ...(partial.deposit ?? {}) },
    withdraw: { ...SITE_SETTINGS_DEFAULTS.withdraw, ...(partial.withdraw ?? {}) },
    support: { ...SITE_SETTINGS_DEFAULTS.support, ...(partial.support ?? {}) },
    notice: partial.notice ?? SITE_SETTINGS_DEFAULTS.notice,
    flashApp: {
      ...SITE_SETTINGS_DEFAULTS.flashApp,
      ...(partial.flashApp ?? {}),
      screenshots: partial.flashApp?.screenshots?.length
        ? partial.flashApp.screenshots.filter(Boolean)
        : SITE_SETTINGS_DEFAULTS.flashApp.screenshots,
    },
    updatedAt: partial.updatedAt ?? null,
  };
}

export function sanitizeFlashAppUrl(value: string) {
  return value.trim();
}
