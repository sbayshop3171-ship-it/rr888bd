'use client';

import Link from 'next/link';
import { t } from '@/lib/strings';
import { BRAND } from '@/lib/brand';
import { useUI } from './UIProvider';

type Item = [emoji: string, label: string, href: string];

const GAME_LINKS: Item[] = [
  ['🎁', 'Free Trial', '/free-trial'],
  ['🔥', 'Hot Games', '/#sec-hot'],
  ['🏏', 'Sports', '/sports'],
  ['🎲', 'Live Casino', '/#sec-live'],
  ['🎰', 'Slots', '/#sec-slot'],
  ['🃏', 'Poker', '/#sec-poker'],
  ['🐟', 'Fishing', '/#sec-fish'],
  ['🏆', 'Jackpot', '/#sec-jackpot'],
  ['🎟️', 'Lottery', '/#sec-lottery'],
];

const ACCOUNT_LINKS: Item[] = [
  ['💰', 'Deposit', '/deposit'],
  ['💸', 'Withdraw', '/withdraw'],
  ['📋', 'Betting Record', '/bets-history'],
  ['📊', 'Account Statement', '/account-statement'],
  ['🎁', 'Reward Center', '/reward'],
  ['👑', 'VIP Club', '/vip'],
  ['👥', 'Refer Friends', '/refer'],
];

const SUPPORT_LINKS: Item[] = [
  ['🎧', 'Customer Support', '/support'],
  ['📱', 'App Download', '/download'],
  ['🛡️', 'Security Center', '/security'],
  ['❓', 'Help Center', '/support'],
];

function Group({ title, items, onNavigate }: { title: string; items: Item[]; onNavigate: () => void }) {
  return (
    <>
      <h4>{title}</h4>
      <ul>
        {items.map(([e, label, href]) => (
          <li key={label}>
            <Link href={href} onClick={onNavigate}>
              <i className="e" aria-hidden>{e}</i>{label}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function Drawer() {
  const { drawerOpen, closeDrawer, leaveDrawer } = useUI();

  return (
    <aside
      className={`drawer${drawerOpen ? ' on' : ''}`}
      aria-hidden={!drawerOpen}
      // keeps the closed drawer out of the tab order on wide viewports
      inert={!drawerOpen}
    >
      <div className="drawer__hd">
        <Link href="/" className="logo" aria-label={BRAND.name} onClick={leaveDrawer}>
          <img className="logo__image" src="/rr888bd-logo.png" alt="" />
        </Link>
      </div>
      <Group title={t.gameCenter} items={GAME_LINKS} onNavigate={leaveDrawer} />
      <Group title={t.myAccount} items={ACCOUNT_LINKS} onNavigate={leaveDrawer} />
      <Group title={t.support} items={SUPPORT_LINKS} onNavigate={leaveDrawer} />
    </aside>
  );
}
