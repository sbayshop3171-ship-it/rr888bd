<?php

namespace App\Http\Controllers;

use App\Models\Deposit;
use App\Models\PaymentChannel;
use App\Models\Withdrawal;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Deposits and withdrawals. Both only ever create a `pending` request — money
 * moves when an admin approves it, never here.
 *
 * Amounts arrive from the form in taka and are stored in paisa.
 */
class CashierController extends Controller
{
    /** Quick-pick chips above the amount box, in taka. */
    private const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000, 25000];

    public function depositForm(): Response
    {
        return Inertia::render('Cashier/Deposit', [
            // `account_no` is Hidden on the model so it never leaks by accident.
            // A deposit channel is the one place a player must see it: it is the
            // operator's own receiving number, and without it there is nowhere to
            // send the money. Withdrawal channels never get this treatment.
            'channels' => PaymentChannel::query()
                ->where('is_active', true)
                ->where('supports_deposit', true)
                ->orderBy('sort_order')
                ->get()
                ->map(fn (PaymentChannel $c) => [
                    ...$c->toArray(),
                    'account_no' => $c->account_no,
                    'account_name' => $c->account_name,
                ]),
            'quickAmounts' => self::QUICK_AMOUNTS,
        ]);
    }

    public function storeDeposit(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'channel_id' => ['required', Rule::exists('payment_channels', 'id')->where('supports_deposit', true)->where('is_active', true)],
            'amount' => ['required', 'numeric', 'min:1'],
            'sender_no' => ['nullable', 'string', 'max:32'],
            'txn_id' => ['nullable', 'string', 'max:64'],
        ], [
            'channel_id.required' => 'পেমেন্ট মেথড বাছুন',
            'amount.required' => 'পরিমাণ দিন',
        ]);

        $channel = PaymentChannel::findOrFail($data['channel_id']);
        $paisa = (int) round($data['amount'] * 100);

        $this->assertWithinLimits($channel, $paisa);

        Deposit::create([
            'user_id' => $request->user()->id,
            'channel_id' => $channel->id,
            'amount' => $paisa,
            'sender_no' => $data['sender_no'] ?? null,
            'txn_id' => $data['txn_id'] ?? null,
        ]);

        return redirect()->route('deposits.history')
            ->with('toast', 'ডিপোজিট রিকোয়েস্ট জমা হয়েছে — অ্যাডমিন অনুমোদন করলে ব্যালেন্সে যোগ হবে');
    }

    public function withdrawForm(Request $request): Response
    {
        $wallet = $request->user()->wallet;

        return Inertia::render('Cashier/Withdraw', [
            'channels' => PaymentChannel::query()
                ->where('is_active', true)
                ->where('supports_withdraw', true)
                ->orderBy('sort_order')
                ->get(),
            'turnoverCleared' => $wallet === null
                || $wallet->turnover_done >= $wallet->turnover_need,
        ]);
    }

    public function storeWithdrawal(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'channel_id' => ['required', Rule::exists('payment_channels', 'id')->where('supports_withdraw', true)->where('is_active', true)],
            'amount' => ['required', 'numeric', 'min:1'],
            'account_no' => ['required', 'string', 'regex:/^01\d{9}$/'],
        ], [
            'account_no.regex' => 'সঠিক ১১ ডিজিটের নাম্বার দিন',
            'amount.required' => 'পরিমাণ দিন',
        ]);

        $channel = PaymentChannel::findOrFail($data['channel_id']);
        $paisa = (int) round($data['amount'] * 100);
        $user = $request->user();
        $wallet = $user->wallet;

        $this->assertWithinLimits($channel, $paisa);

        if ($paisa > ($wallet?->balance ?? 0)) {
            throw ValidationException::withMessages(['amount' => 'ব্যালেন্স যথেষ্ট নয়']);
        }

        if ($wallet && $wallet->turnover_done < $wallet->turnover_need) {
            throw ValidationException::withMessages([
                'amount' => 'বোনাসের টার্নওভার সম্পূর্ণ হয়নি — এখন উইথড্র করা যাবে না',
            ]);
        }

        // The request debits immediately so the same money cannot be withdrawn again.
        $held = Withdrawal::where('user_id', $user->id)->where('state', 'pending')->sum('amount');
        if ($paisa + $held > ($wallet?->balance ?? 0)) {
            throw ValidationException::withMessages([
                'amount' => 'আগের পেন্ডিং উইথড্র বাদ দিলে এত ব্যালেন্স নেই',
            ]);
        }

        $wallet->decrement('balance', $paisa);

        Withdrawal::create([
            'user_id' => $user->id,
            'channel_id' => $channel->id,
            'amount' => $paisa,
            'account_no' => $data['account_no'],
            'state' => 'pending',
        ]);

        return redirect()->route('withdrawals.history')
            ->with('toast', 'উইথড্র রিকোয়েস্ট জমা হয়েছে — অনুমোদনের পর পাঠানো হবে');
    }

    public function depositHistory(Request $request): Response
    {
        return Inertia::render('Cashier/DepositHistory', [
            'rows' => $request->user()->deposits()
                ->with('channel:id,name')
                ->latest()
                ->paginate(20),
        ]);
    }

    public function withdrawalHistory(Request $request): Response
    {
        return Inertia::render('Cashier/WithdrawHistory', [
            'rows' => $request->user()->withdrawals()
                ->with('channel:id,name')
                ->latest()
                ->paginate(20),
        ]);
    }

    /**
     * @throws ValidationException
     */
    private function assertWithinLimits(PaymentChannel $channel, int $paisa): void
    {
        if ($paisa < $channel->min_amount || $paisa > $channel->max_amount) {
            $min = number_format($channel->min_amount / 100);
            $max = number_format($channel->max_amount / 100);

            throw ValidationException::withMessages([
                'amount' => "{$channel->name} এর জন্য ৳{$min} — ৳{$max} এর মধ্যে দিন",
            ]);
        }
    }
}
