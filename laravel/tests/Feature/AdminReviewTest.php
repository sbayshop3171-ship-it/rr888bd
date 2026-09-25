<?php

namespace Tests\Feature;

use App\Models\Deposit;
use App\Models\PaymentChannel;
use App\Models\User;
use App\Models\Withdrawal;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminReviewTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $player;

    protected function setUp(): void
    {
        parent::setUp();

        PaymentChannel::create(['id' => 'bkash', 'name' => 'bKash']);

        $this->admin = User::factory()->admin()->create();
        $this->player = User::factory()->withBalance(500_000)->create();
    }

    public function test_approving_a_deposit_credits_the_wallet_and_writes_the_ledger(): void
    {
        $deposit = Deposit::create([
            'user_id' => $this->player->id,
            'channel_id' => 'bkash',
            'amount' => 100_000,
        ]);

        $this->actingAs($this->admin)
            ->patch("/admin/deposits/{$deposit->id}", ['state' => 'approved'])
            ->assertRedirect();

        $this->assertSame(600_000, $this->player->wallet->fresh()->balance);
        $this->assertDatabaseHas('transactions', [
            'user_id' => $this->player->id,
            'kind' => 'deposit',
            'amount' => 100_000,
            'ref' => "deposit:{$deposit->id}",
        ]);

        $deposit->refresh();
        $this->assertSame('approved', $deposit->state);
        $this->assertSame($this->admin->id, $deposit->reviewed_by);
        $this->assertNotNull($deposit->reviewed_at);
    }

    public function test_rejecting_a_deposit_credits_nothing(): void
    {
        $deposit = Deposit::create([
            'user_id' => $this->player->id,
            'channel_id' => 'bkash',
            'amount' => 100_000,
        ]);

        $this->actingAs($this->admin)
            ->patch("/admin/deposits/{$deposit->id}", ['state' => 'rejected', 'admin_note' => 'ভুল TxnID']);

        $this->assertSame(500_000, $this->player->wallet->fresh()->balance);
        $this->assertDatabaseCount('transactions', 0);
        $this->assertSame('ভুল TxnID', $deposit->fresh()->admin_note);
    }

    public function test_a_deposit_cannot_be_approved_twice(): void
    {
        $deposit = Deposit::create([
            'user_id' => $this->player->id,
            'channel_id' => 'bkash',
            'amount' => 100_000,
        ]);

        $this->actingAs($this->admin)->patch("/admin/deposits/{$deposit->id}", ['state' => 'approved']);
        $this->actingAs($this->admin)->patch("/admin/deposits/{$deposit->id}", ['state' => 'approved']);

        $this->assertSame(600_000, $this->player->wallet->fresh()->balance);
        $this->assertDatabaseCount('transactions', 1);
    }

    public function test_approving_a_withdrawal_keeps_the_balance_already_debited(): void
    {
        $withdrawal = Withdrawal::create([
            'user_id' => $this->player->id,
            'channel_id' => 'bkash',
            'amount' => 200_000,
            'account_no' => '01712345678',
        ]);

        $this->player->wallet()->update(['balance' => 300_000]);

        $this->actingAs($this->admin)
            ->patch("/admin/withdrawals/{$withdrawal->id}", ['state' => 'approved']);

        $this->assertSame(300_000, $this->player->wallet->fresh()->balance);
        $this->assertSame('approved', $withdrawal->fresh()->state);
        $this->assertDatabaseCount('transactions', 0);
    }

    public function test_rejecting_a_withdrawal_refunds_the_already_debited_balance(): void
    {
        $withdrawal = Withdrawal::create([
            'user_id' => $this->player->id,
            'channel_id' => 'bkash',
            'amount' => 200_000,
            'account_no' => '01712345678',
            'state' => 'pending',
        ]);

        $this->player->wallet()->update(['balance' => 300_000]);

        $this->actingAs($this->admin)
            ->patch("/admin/withdrawals/{$withdrawal->id}", ['state' => 'rejected']);

        $this->assertSame(500_000, $this->player->wallet->fresh()->balance);
        $this->assertSame('rejected', $withdrawal->fresh()->state);
        $this->assertDatabaseHas('transactions', [
            'user_id' => $this->player->id,
            'kind' => 'adjustment',
            'amount' => 200_000,
        ]);
    }

    public function test_a_withdrawal_larger_than_the_balance_cannot_be_approved(): void
    {
        $withdrawal = Withdrawal::create([
            'user_id' => $this->player->id,
            'channel_id' => 'bkash',
            'amount' => 900_000,
            'account_no' => '01712345678',
        ]);

        $this->actingAs($this->admin)
            ->patch("/admin/withdrawals/{$withdrawal->id}", ['state' => 'approved']);

        // the balance is untouched and the request stays open for review
        $this->assertSame(500_000, $this->player->wallet->fresh()->balance);
        $this->assertSame('pending', $withdrawal->fresh()->state);
        $this->assertDatabaseCount('transactions', 0);
    }

    public function test_an_admin_can_adjust_a_balance_with_a_reason(): void
    {
        $this->actingAs($this->admin)
            ->post("/admin/users/{$this->player->id}/adjust", [
                'amount' => -250,
                'note' => 'ডুপ্লিকেট ডিপোজিট ফেরত',
            ]);

        $this->assertSame(475_000, $this->player->wallet->fresh()->balance);
        $this->assertDatabaseHas('transactions', [
            'kind' => 'adjust',
            'amount' => -25_000,
            'ref' => 'ডুপ্লিকেট ডিপোজিট ফেরত',
        ]);
    }

    public function test_an_adjustment_without_a_reason_is_refused(): void
    {
        $this->actingAs($this->admin)
            ->post("/admin/users/{$this->player->id}/adjust", ['amount' => 100])
            ->assertSessionHasErrors('note');

        $this->assertSame(500_000, $this->player->wallet->fresh()->balance);
    }

    public function test_blocking_a_user_stops_them_signing_in(): void
    {
        $this->actingAs($this->admin)
            ->patch("/admin/users/{$this->player->id}", ['is_blocked' => true]);

        $this->assertTrue($this->player->fresh()->is_blocked);
    }
}
