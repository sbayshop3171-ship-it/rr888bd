'use client';

import { useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { RightIcon } from '@/components/Icons';
import {
  activeSorted,
  DEFAULT_ANNOUNCEMENTS,
  type Announcement,
  type AnnouncementInput,
} from '@/lib/site-content';
import { useLightSheet } from '@/components/useLightSheet';

/* ============================================================
   Internal Message.

   The reference calls its mailbox this, and everything in it is
   sent by "Platform" — the operator's own announcements, one row
   per card, newest first. That is exactly what /admin/banners
   already writes, so this reads the same feed the promo popup and
   the carousel read rather than inventing a second one.

   Outbox is a real tab there and it is always empty: a player
   cannot write to the platform from this screen, they use
   Complaint / suggestion. It is kept, and says so.
   ============================================================ */

type Tab = 'inbox' | 'outbox';

/** Read marks live in the browser: there is no per-player mail table to
    write to, and a read flag that only matters to the person reading it is
    not worth one. */
const READ_KEY = 'rr888bd:mail-read';

export default function MessagesPage() {
  useLightSheet();
  const [cards, setCards] = useState<(AnnouncementInput | Announcement)[]>(DEFAULT_ANNOUNCEMENTS);
  const [tab, setTab] = useState<Tab>('inbox');
  const [read, setRead] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/site-content', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { announcements?: Announcement[] } | null) => {
        const live = data?.announcements ? activeSorted(data.announcements) : null;
        if (live?.length) setCards(live);
      })
      .catch(() => {});

    try {
      const raw = localStorage.getItem(READ_KEY);
      if (raw) setRead(JSON.parse(raw) as string[]);
    } catch { /* private mode — everything reads as unread */ }
  }, []);

  const rows = useMemo(
    () => cards.map((c, i) => ({
      id: 'id' in c && c.id ? c.id : `d${i}`,
      title: c.title,
      note: c.note,
      at: 'updatedAt' in c && c.updatedAt ? c.updatedAt : null,
    })),
    [cards],
  );

  const markRead = (ids: string[]) => {
    const next = Array.from(new Set([...read, ...ids]));
    setRead(next);
    try { localStorage.setItem(READ_KEY, JSON.stringify(next)); } catch { /* fine */ }
  };

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const allPicked = rows.length > 0 && picked.length === rows.length;

  return (
    <>
      <PageHeader title="Internal Message" />

      <div className="ml">
        <div className="ml__tabs">
          <button type="button" className={tab === 'inbox' ? 'on' : ''} onClick={() => setTab('inbox')}>Inbox</button>
          <button type="button" className={tab === 'outbox' ? 'on' : ''} onClick={() => setTab('outbox')}>Outbox</button>
        </div>

        {tab === 'inbox' ? (
          <>
            <div className="ml__bar">
              <label className="ml__check">
                <input
                  type="checkbox"
                  checked={allPicked}
                  onChange={() => setPicked(allPicked ? [] : rows.map((r) => r.id))}
                />
                <span>Select all</span>
              </label>
              <button
                type="button"
                className="ml__act"
                disabled={picked.length === 0}
                onClick={() => { markRead(picked); setPicked([]); }}
              >
                Mark read
              </button>
            </div>

            {rows.length === 0 ? (
              <p className="ml__empty">No data</p>
            ) : (
              <ul className="ml__list">
                {rows.map((r) => (
                  <li key={r.id} className="ml__row">
                    <input
                      type="checkbox"
                      checked={picked.includes(r.id)}
                      onChange={() => toggle(r.id)}
                      aria-label={r.title}
                    />
                    <button
                      type="button"
                      className="ml__open"
                      onClick={() => { setOpenId(openId === r.id ? null : r.id); markRead([r.id]); }}
                    >
                      <span className="ml__head">
                        <span className={`ml__dot${read.includes(r.id) ? ' is-read' : ''}`} aria-hidden />
                        Sender: Platform
                        {r.at && <time>{r.at.replace('T', ' ').slice(0, 19)}</time>}
                      </span>
                      <span className="ml__title">Title: {r.title}</span>
                      {openId === r.id && r.note && <span className="ml__body">{r.note}</span>}
                    </button>
                    <RightIcon />
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="ml__empty">
            No data
            <small>To send us a message, use the Complaint / suggestion page.</small>
          </p>
        )}
      </div>
    </>
  );
}
