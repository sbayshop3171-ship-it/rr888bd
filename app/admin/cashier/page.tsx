import NoAccess from '@/components/admin/NoAccess';
import CashierConfigControl from '@/components/admin/CashierConfigControl';
import { getCurrentAdminSession } from '@/lib/admin-auth-next';
import { can } from '@/lib/admin-roles';
import { getCashierConfig } from '@/lib/cashier-config-store';
import { DEPOSIT_CHANNELS } from '@/lib/payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The cashier the players see: deposit methods with their bonus, the amount
    chips, every line of copy, and the withdraw rules. */
export default async function AdminCashier() {
  const session = await getCurrentAdminSession();
  if (!session) return null;
  if (!can(session, 'cashier.config')) return <NoAccess what="Cashier setup" />;

  return (
    <>
      <h1 className="adm__h1">Cashier</h1>
      <p className="adm__sub">
        Everything the player sees on the deposit and withdraw pages — methods, bonus
        labels, amount chips, instructions, warnings, success messages, and separate
        percentage/fixed fees with an on/off switch — is set here and goes live on save.
        Deposit fees reduce wallet credit; withdrawal fees reduce payout while the gross
        request is held. The receiving numbers live in the “Payments” tab.
      </p>
      <CashierConfigControl
        initial={await getCashierConfig()}
        channels={DEPOSIT_CHANNELS.map(({ id, name }) => ({ id, name }))}
      />
    </>
  );
}
