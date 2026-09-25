import NoAccess from '@/components/admin/NoAccess';
import PlayerControl from '@/components/admin/PlayerControl';
import { getCurrentAdminSession } from '@/lib/admin-auth-next';
import { can } from '@/lib/admin-roles';
import { listPlayers } from '@/lib/cashier';
import { playerScope } from '@/lib/player-scope';
import { isBackendReady } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function AdminUsers() {
  const session = await getCurrentAdminSession();
  if (!session) return null;
  if (!can(session, 'players.read')) return <NoAccess what="The player list" />;

  let players;
  try {
    players = await listPlayers('', 100, await playerScope(session));
  } catch (error) {
    players = {
      ok: false as const,
      reason: 'db-error' as const,
      message: error instanceof Error ? error.message : 'The player list could not be read',
    };
  }

  return (
    <>
      <h1 className="adm__h1">Users</h1>
      <p className="adm__sub">
        Find a player by their ID, phone or name. Adjust a balance, lock their withdrawals, put
        an account on hold, or ban it. Every balance change is written to the ledger, and every
        lock, hold or ban keeps its reason and who set it. A locked player can appeal from My
        Account — their appeal waits here under “Locked &amp; appeals”.
      </p>
      <PlayerControl
        scopedToAgent={!can(session, 'agents.read')}
        initialPlayers={players.ok ? players.data : []}
        initialError={players.ok ? '' : players.message ?? `Could not load the players (${players.reason})`}
        backendReady={isBackendReady()}
        canWrite={can(session, 'players.write')}
        canLock={can(session, 'players.lock')}
      />
    </>
  );
}
