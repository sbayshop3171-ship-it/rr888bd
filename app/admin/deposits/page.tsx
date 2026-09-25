import NoAccess from '@/components/admin/NoAccess';
import CashierControl from '@/components/admin/CashierControl';
import Link from 'next/link';
import { getCurrentAdminSession } from '@/lib/admin-auth-next';
import { can } from '@/lib/admin-roles';
import { listCashier } from '@/lib/cashier';
import { isBackendReady } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function AdminDeposits() {
  const session = await getCurrentAdminSession();
  if (!session) return null;
  if (!can(session, 'deposits.review')) return <NoAccess what="Deposit requests" />;

  let rows: Awaited<ReturnType<typeof listCashier>> = { ok: true, data: [] };

  try {
    rows = await listCashier('deposits', 'pending');
  } catch (error) {
    console.error('Deposits Page Load Error:', error);
    rows = {
      ok: false,
      reason: 'db-error',
      message: 'Could not load the requests. The database may be unavailable.',
    };
  }

  return (
    <>
      <h1 className="adm__h1">Deposit Requests</h1>
      <p className="adm__sub">
        Approving one credits the player’s wallet and writes a ledger entry — both
        together, with no way for one to happen without the other. Pressing approve twice
        on the same request still only pays once. Configure deposit percentage/fixed fees
        in <Link href="/admin/cashier">Cashier settings</Link>.
      </p>
      <CashierControl
        table="deposits"
        initialRows={rows.ok ? rows.data : []}
        initialError={rows.ok ? '' : rows.message ?? `Could not load the requests (${rows.reason})`}
        backendReady={isBackendReady()}
      />
    </>
  );
}
