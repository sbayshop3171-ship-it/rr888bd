<?php

namespace Tests\Feature;

use App\Models\Deposit;
use App\Models\PaymentChannel;
use App\Models\User;
use App\Models\Wallet;
use App\Models\Withdrawal;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CashierTest extends TestCase
{
    use RefreshDatabase;

    private User $player;

    protected function setUp(): void
    {
        parent::setUp();

        PaymentChannel::create([
            'id' => 'bkash',
            'name' => 'bKash',
            'min_amount' => 30_000,     // BDT 300
            'max_amount' => 3_000_000,  // BDT 30,000
        ]);

        $this->player = User::factory()->withBalance(500_000)->create();
    }

    public function test_a_deposit_request_is_only_pending_and_credits_nothing(): void
    {
        $this->actingAs($this->player)
            ->post('/deposit', ['channel_id' => 'bkash', 'amount' => 1000])
            ->assertRedirect('/deposit-history');

        $this->assertDatabaseHas('deposits', [
            'user_id' => $this->player->id,
            'amount' => 100_000,
            'state' => 'pending',
        ]);

        $this->assertSame(500_000, $this->player->wallet->fresh()->balance);
        $this->assertDatabaseCount('transactions', 0);
    }

    public function test_a_deposit_below_the_channel_minimum_is_rejected(): void
    {
        $this->actingAs($this->player)
            ->post('/deposit', ['channel_id' => 'bkash', 'amount' => 100])
            ->assertSessionHasErrors('amount');

        $this->assertDatabaseCount('deposits', 0);
    }

    public function test_a_deposit_above_the_channel_maximum_is_rejected(): void
    {
        $this->actingAs($this->player)
            ->post('/deposit', ['channel_id' => 'bkash', 'amount' => 99_999])
            ->assertSessionHasErrors('amount');

        $this->assertDatabaseCount('deposits', 0);
    }

    public function test_a_guest_cannot_reach_the_cashier(): void
    {
        $this->post('/deposit', ['channel_id' => 'bkash', 'amount' => 1000])
            ->assertRedirect('/login');

        $this->get('/withdraw')->assertRedirect('/login');
    }

    public function test_a_withdrawal_request_is_pending_and_debits_the_wallet_immediately(): void
    {
        $this->actingAs($this->player)
            ->post('/withdraw', [
                'channel_id' => 'bkash',
                'amount' => 1000,
                'account_no' => '01712345678',
            ])
            ->assertRedirect('/withdraw-history');

        $this->assertDatabaseHas('withdrawals', [
            'user_id' => $this->player->id,
            'amount' => 100_000,
            'state' => 'pending',
        ]);

        $this->assertSame(400_000, $this->player->wallet->fresh()->balance);
        $this->assertDatabaseHas('transactions', [
            'user_id' => $this->player->id,
            'kind' => 'withdrawal_hold',
            'amount' => -100_000,
        ]);
    }

    public function test_a_withdrawal_larger_than_the_balance_is_rejected(): void
    {
        $this->actingAs($this->player)
            ->post('/withdraw', [
                'channel_id' => 'bkash',
                'amount' => 9000,
                'account_no' => '01712345678',
            ])
            ->assertSessionHasErrors('amount');

        $this->assertDatabaseCount('withdrawals', 0);
    }

    public function test_an_unfinished_bonus_turnover_blocks_a_withdrawal(): void
    {
        Wallet::where('user_id', $this->player->id)->update([
            'turnover_need' => 100_000,
            'turnover_done' => 40_000,
        ]);

        $this->actingAs($this->player)
            ->post('/withdraw', [
                'channel_id' => 'bkash',
                'amount' => 1000,
                'account_no' => '01712345678',
            ])
            ->assertSessionHasErrors('amount');

        $this->assertDatabaseCount('withdrawals', 0);
    }

    public function test_pending_withdrawals_already_claim_part_of_the_balance(): void
    {
        Withdrawal::create([
            'user_id' => $this->player->id,
            'channel_id' => 'bkash',
            'amount' => 400_000,
            'account_no' => '01712345678',
        ]);

        // 4,000 is pending out of a 5,000 balance, so 2,000 more must fail
        $this->actingAs($this->player)
            ->post('/withdraw', [
                'channel_id' => 'bkash',
                'amount' => 2000,
                'account_no' => '01712345678',
            ])
            ->assertSessionHasErrors('amount');

        $this->assertSame(1, Withdrawal::where('user_id', $this->player->id)->count());
    }

    public function test_a_player_only_sees_their_own_history(): void
    {
        $other = User::factory()->create();

        Deposit::create(['user_id' => $this->player->id, 'channel_id' => 'bkash', 'amount' => 100_000]);
        Deposit::create(['user_id' => $other->id, 'channel_id' => 'bkash', 'amount' => 900_000]);

        $this->actingAs($this->player)
            ->get('/deposit-history')
            ->assertInertia(fn ($page) => $page
                ->component('Cashier/DepositHistory')
                ->has('rows.data', 1)
                ->where('rows.data.0.amount', 100_000));
    }
}
