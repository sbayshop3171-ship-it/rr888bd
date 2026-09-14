<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingSeeder extends Seeder
{
    public function run(): void
    {
        Setting::put('site', [
            'name' => 'rr888bd',
            'domain' => 'rr888bd.site',
            'currency' => 'BDT',
        ]);

        Setting::put('support', [
            'email' => 'mpmony1@gmail.com',
            'whatsapp' => 'https://wa.me/8801000000000',
            'telegram' => 'https://t.me/',
            'facebook' => 'https://facebook.com/',
        ]);

        // amount is paisa; turnover_multiplier is how many times it must be
        // wagered before the balance can be withdrawn
        Setting::put('signup_bonus', [
            'amount' => 0,
            'turnover_multiplier' => 10,
        ]);

        // Daily check-in. `amount` is paisa; a bonus is only withdrawable once
        // it has been wagered `turnover_multiplier` times.
        Setting::put('checkin_bonus', [
            'amount' => 500,
            'turnover_multiplier' => 10,
        ]);

        // Referral commission, in basis points of what a referred player lost.
        // Zero until an operator picks a rate — the refer screen shows whatever
        // is set here, so it is never a promise the site cannot keep.
        Setting::put('referral', [
            'rate_bp' => 0,
        ]);

        Setting::put('app_links', [
            'android' => null,
            'ios' => null,
        ]);
    }
}
