import NoAccess from '@/components/admin/NoAccess';
import CashierControl from '@/components/admin/CashierControl';
import Link from 'next/link';
import { getCurrentAdminSession } from '@/lib/admin-auth-next';
import { can } from '@/lib/admin-roles';
import { listCashier } from '@/lib/cashier';
import { isBackendReady } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function AdminWithdrawals() {
  const session = await getCurrentAdminSession();
  if (!session) return null;
  if (!can(session, 'withdrawals.review')) return <NoAccess what="Withdrawal requests" />;

  let rows: Awaited<ReturnType<typeof listCashier>> = { ok: true, data: [] };

  try {
    rows = await listCashier('withdrawals', 'pending');
  } catch (error) {
    console.error('Withdrawals Page Load Error:', error);
    rows = {
      ok: false,
      reason: 'db-error',
      message: 'Could not load the requests. The database may be unavailable.',
    };
  }

  return (
    <>
      <h1 className="adm__h1">Withdrawal Requests</h1>
      <p className="adm__sub">
        The gross withdrawal amount is held immediately when the player submits the
        request. Approve sends the net payout after the configured fee; reject refunds
        the full held amount automatically. Lock rejects the request and also stops the
        player's future withdrawals, with the reason shown in My Account. Configure
        withdrawal percentage/fixed fees in <Link href="/admin/cashier">Cashier settings</Link>.
      </p>
      <CashierControl
        table="withdrawals"
        initialRows={rows.ok ? rows.data : []}
        initialError={rows.ok ? '' : rows.message ?? `Could not load the requests (${rows.reason})`}
        backendReady={isBackendReady()}
        canLock={can(session, 'players.lock')}
      />
    </>
  );
}
