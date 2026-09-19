'use client';

import { useState } from 'react';
import { BRAND } from '@/lib/brand';
import { DEPOSIT_CHANNELS } from '@/lib/payments';
import type { SiteSettings } from '@/lib/site-settings';

const ERROR_LABEL: Record<string, string> = {
  'invalid-limit': 'Those limits are wrong — the minimum must be 0 or more and below the maximum.',
  'invalid-url': 'The link must start with https:// (leave it blank to drop the button).',
  'invalid-email': 'That email address is not valid (leave it blank to hide the email).',
  'unknown-channel': 'Unknown payment channel — refresh the page.',
  unauthorized: 'Your session has expired — log in again.',
};

const CHANNEL_NAME = Object.fromEntries(DEPOSIT_CHANNELS.map((c) => [c.id, c.name]));

/** Cashier limits, support links and the running notice — the numbers the
    deposit / withdraw screens print, editable without a code change. */
export default function SiteSettingsControl({ initial }: { initial: SiteSettings }) {
  const [saved, setSaved] = useState(initial);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [screenshotInput, setScreenshotInput] = useState('');

  async function readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsDataURL(file);
    });
  }

  async function addScreenshotFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Only image files are accepted for screenshots.');
      return;
    }
    try {
      const dataUrl = await readAsDataUrl(file);
      setForm((f) => ({
        ...f,
        flashApp: {
          ...f.flashApp,
          screenshots: [...f.flashApp.screenshots, dataUrl],
        },
      }));
      setNotice('New screenshot uploaded and added to the list.');
    } catch {
      setError('Could not read the file. Try again.');
    }
  }

  async function replaceScreenshotFile(index: number, file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Only image files are accepted for screenshots.');
      return;
    }
    try {
      const dataUrl = await readAsDataUrl(file);
      setForm((f) => {
        const screenshots = [...f.flashApp.screenshots];
        screenshots[index] = dataUrl;
        return {
          ...f,
          flashApp: {
            ...f.flashApp,
            screenshots,
          },
        };
      });
      setNotice('Screenshot replaced successfully.');
    } catch {
      setError('Could not replace the screenshot. Try again.');
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/admin/site-settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          deposit: form.deposit,
          withdraw: form.withdraw,
          support: form.support,
          notice: form.notice,
          flashApp: form.flashApp,
        }),
      });
      const data = (await res.json()) as
        | { ok: true; settings: SiteSettings }
        | { ok: false; reason: string; field?: string };

      if (!data.ok) {
        const where = data.field && CHANNEL_NAME[data.field] ? ` (${CHANNEL_NAME[data.field]})` : '';
        setError((ERROR_LABEL[data.reason] ?? `Something went wrong (${data.reason})`) + where);
        return;
      }
      setSaved(data.settings);
      setForm(data.settings);
      setNotice('Settings saved — live on the site now.');
    } catch {
      setError('Could not reach the server — try again.');
    } finally {
      setBusy(false);
    }
  }

  const num = (value: number) => (Number.isFinite(value) ? value : '');

  return (
    <form onSubmit={submit}>
      <div className="adm__card">
        <h2 className="adm__cardh">Deposit methods &amp; limits</h2>
        <p className="adm__hint" style={{ margin: 0 }}>
          Deposit methods, their minimums and maximums, bonuses and page copy now live in the
          <a href="/admin/cashier" style={{ color: 'var(--mint)', marginLeft: 4 }}>Cashier tab</a>.
        </p>
      </div>

      <div className="adm__card">
        <h2 className="adm__cardh">Withdrawal limits (৳)</h2>
        <div className="adm__formgrid">
          <label className="adm__f">
            <span>Minimum withdrawal</span>
            <input
              type="number" min={0} step={1} value={num(form.withdraw.min)} disabled={busy}
              onChange={(e) => setForm((f) => ({ ...f, withdraw: { ...f.withdraw, min: Number(e.target.value) } }))}
            />
          </label>
          <label className="adm__f">
            <span>Maximum withdrawal (per request)</span>
            <input
              type="number" min={0} step={1} value={num(form.withdraw.max)} disabled={busy}
              onChange={(e) => setForm((f) => ({ ...f, withdraw: { ...f.withdraw, max: Number(e.target.value) } }))}
            />
          </label>
        </div>
      </div>

      <div className="adm__card">
        <h2 className="adm__cardh">Support links</h2>
        <div className="adm__formgrid">
          {(['whatsapp', 'telegram', 'facebook'] as const).map((key) => (
            <label className="adm__f" key={key}>
              <span>{key === 'whatsapp' ? 'WhatsApp' : key === 'telegram' ? 'Telegram' : 'Facebook'}</span>
              <input
                type="url" placeholder="https://…" value={form.support[key]} disabled={busy}
                onChange={(e) => setForm((f) => ({ ...f, support: { ...f.support, [key]: e.target.value } }))}
              />
            </label>
          ))}
          <label className="adm__f">
            <span>Support email</span>
            <input
              type="email" placeholder="support@example.com" value={form.support.email} disabled={busy}
              onChange={(e) => setForm((f) => ({ ...f, support: { ...f.support, email: e.target.value } }))}
            />
          </label>
        </div>
        <p className="adm__hint">
          The floating buttons, the support page and the footer all use these. Leave one
          blank and that row or button disappears.
        </p>
      </div>

      <div className="adm__card">
        <h2 className="adm__cardh">Scrolling notice</h2>
        <label className="adm__f adm__f--wide">
          <span>Text that scrolls across the top of the home page</span>
          <input
            value={form.notice} placeholder={`Leave blank to show the ${BRAND.name} welcome message`}
            maxLength={200} disabled={busy}
            onChange={(e) => setForm((f) => ({ ...f, notice: e.target.value }))}
          />
        </label>
      </div>

      <div className="adm__card">
        <h2 className="adm__cardh">App Store Screenshots</h2>
        <p className="adm__hint" style={{ marginTop: 0 }}>
          Upload, edit, remove and reorder screenshots for the /flash-app app listing. The live page updates as soon as you save the settings.
        </p>

        <div className="adm__formgrid">
          <label className="adm__f">
            <span>App name</span>
            <input
              value={form.flashApp.appName} disabled={busy}
              onChange={(e) => setForm((f) => ({ ...f, flashApp: { ...f.flashApp, appName: e.target.value } }))}
            />
          </label>
          <label className="adm__f">
            <span>Short name</span>
            <input
              value={form.flashApp.shortName} disabled={busy}
              onChange={(e) => setForm((f) => ({ ...f, flashApp: { ...f.flashApp, shortName: e.target.value } }))}
            />
          </label>
          <label className="adm__f adm__f--wide">
            <span>Tagline</span>
            <input
              value={form.flashApp.tagline} disabled={busy}
              onChange={(e) => setForm((f) => ({ ...f, flashApp: { ...f.flashApp, tagline: e.target.value } }))}
            />
          </label>
          <label className="adm__f adm__f--wide">
            <span>App logo URL</span>
            <input
              type="url" value={form.flashApp.logoUrl} disabled={busy}
              onChange={(e) => setForm((f) => ({ ...f, flashApp: { ...f.flashApp, logoUrl: e.target.value } }))}
            />
          </label>
        </div>

        <div className="adm__formgrid" style={{ marginTop: 12 }}>
          <label className="adm__f adm__f--wide">
            <span>Upload new screenshot image</span>
            <input
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                await addScreenshotFile(file);
                e.target.value = '';
              }}
            />
          </label>
          <label className="adm__f adm__f--wide">
            <span>Add screenshot URL</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={screenshotInput}
                onChange={(e) => setScreenshotInput(e.target.value)}
                placeholder="https://example.com/screenshot.jpg"
                disabled={busy}
              />
              <button
                type="button"
                className="btn btn--gold"
                onClick={() => {
                  const clean = screenshotInput.trim();
                  if (!clean) return;
                  setForm((f) => ({
                    ...f,
                    flashApp: {
                      ...f.flashApp,
                      screenshots: [...f.flashApp.screenshots, clean],
                    },
                  }));
                  setScreenshotInput('');
                }}
              >
                Add
              </button>
            </div>
          </label>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 14 }}>
          {form.flashApp.screenshots.map((src, index) => (
            <div key={`${src}-${index}`} style={{ width: 120, padding: 8, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ position: 'relative', width: '100%', height: 150 }}>
                <img src={src} alt={`Flash app screenshot ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)' }} />
                <button
                  type="button"
                  aria-label={`Move screenshot ${index + 1} up`}
                  onClick={() => setForm((f) => {
                    const screenshots = [...f.flashApp.screenshots];
                    if (index === 0) return f;
                    [screenshots[index - 1], screenshots[index]] = [screenshots[index], screenshots[index - 1]];
                    return { ...f, flashApp: { ...f.flashApp, screenshots } };
                  })}
                  style={{ position: 'absolute', top: 6, left: 6, width: 22, height: 22, borderRadius: '50%', border: '0', background: 'rgba(0,0,0,0.65)', color: '#fff', cursor: 'pointer' }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move screenshot ${index + 1} down`}
                  onClick={() => setForm((f) => {
                    const screenshots = [...f.flashApp.screenshots];
                    if (index === screenshots.length - 1) return f;
                    [screenshots[index], screenshots[index + 1]] = [screenshots[index + 1], screenshots[index]];
                    return { ...f, flashApp: { ...f.flashApp, screenshots } };
                  })}
                  style={{ position: 'absolute', top: 6, right: 30, width: 22, height: 22, borderRadius: '50%', border: '0', background: 'rgba(0,0,0,0.65)', color: '#fff', cursor: 'pointer' }}
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label={`Remove screenshot ${index + 1}`}
                  onClick={() => setForm((f) => ({
                    ...f,
                    flashApp: {
                      ...f.flashApp,
                      screenshots: f.flashApp.screenshots.filter((_, i) => i !== index),
                    },
                  }))}
                  style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', border: '0', background: 'rgba(0,0,0,0.65)', color: '#fff', cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>

              <label className="adm__f" style={{ marginTop: 8 }}>
                <span>Edit image URL</span>
                <input
                  value={src}
                  disabled={busy}
                  onChange={(e) => setForm((f) => {
                    const screenshots = [...f.flashApp.screenshots];
                    screenshots[index] = e.target.value;
                    return { ...f, flashApp: { ...f.flashApp, screenshots } };
                  })}
                />
              </label>

              <label className="adm__f" style={{ marginTop: 8 }}>
                <span>Replace file</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={busy}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    await replaceScreenshotFile(index, file);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="adm__err">{error}</p>}
      {notice && <p className="adm__note">{notice}</p>}

      <div className="adm__actions">
        <button type="submit" className="btn btn--gold" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => { setForm(saved); setError(''); setNotice(''); }}>
          Cancel
        </button>
      </div>
      {saved.updatedAt && (
        <p className="adm__hint">Last saved: {new Date(saved.updatedAt).toLocaleString('en-GB')}</p>
      )}
    </form>
  );
}
