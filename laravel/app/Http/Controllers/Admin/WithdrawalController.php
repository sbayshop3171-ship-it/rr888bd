<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Withdrawal;
use App\Services\AuditLog;
use App\Services\WalletService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

class WithdrawalController extends Controller
{
    public function index(Request $request): Response
    {
        $state = $request->string('state', 'pending')->toString();

        return Inertia::render('Admin/Withdrawals', [
            'rows' => Withdrawal::query()
                ->with(['user:id,phone', 'channel:id,name', 'user.wallet'])
                ->when($state !== 'all', fn ($q) => $q->where('state', $state))
                ->latest()
                ->paginate(30)
                ->withQueryString(),
            'state' => $state,
        ]);
    }

    /** Approving debits the wallet; the money leaves the platform here. */
    public function update(Request $request, Withdrawal $withdrawal, WalletService $wallet, AuditLog $audit): RedirectResponse
    {
        $data = $request->validate([
            'state' => ['required', 'in:approved,rejected'],
            'admin_note' => ['nullable', 'string', 'max:255'],
        ]);

        if ($withdrawal->state !== 'pending') {
            return back()->with('toast', 'এই রিকোয়েস্ট আগেই রিভিউ হয়ে গেছে');
        }

        try {
            DB::transaction(function () use ($withdrawal, $data, $request, $wallet, $audit): void {
                if ($data['state'] === 'rejected') {
                    $wallet->apply($withdrawal->user_id, 'adjust', $withdrawal->amount, "withdrawal:{$withdrawal->id}:refund");
                }

                $withdrawal->forceFill([
                    'state' => $data['state'],
                    'admin_note' => $data['admin_note'] ?? null,
                    'reviewed_by' => $request->user()->id,
                    'reviewed_at' => now(),
                ])->save();

                $audit->record(
                    action: "withdrawal.{$data['state']}",
                    subjectType: 'withdrawal',
                    subjectId: $withdrawal->id,
                    targetUser: $withdrawal->user_id,
                    amount: $data['state'] === 'rejected' ? $withdrawal->amount : null,
                    note: $data['admin_note'] ?? null,
                );
            });
        } catch (RuntimeException $e) {
            return back()->with('toast', "অনুমোদন করা যায়নি: {$e->getMessage()}");
        }

        return back()->with('toast', $data['state'] === 'approved'
            ? 'উইথড্র অনুমোদন হয়েছে — ব্যালেন্স থেকে কাটা হয়েছে'
            : 'উইথড্র বাতিল হয়েছে');
    }
}
