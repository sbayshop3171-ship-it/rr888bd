CREATE DATABASE IF NOT EXISTS `rr888bd` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `rr888bd`;

DROP TABLE IF EXISTS `profiles`, `deposits`, `withdrawals`;

CREATE TABLE IF NOT EXISTS `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `phone` varchar(15) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `display_name` varchar(100) DEFAULT NULL,
  `role` enum('player','agent','admin') NOT NULL DEFAULT 'player',
  `vip_level` tinyint unsigned NOT NULL DEFAULT 0,
  `referral_code` varchar(32) DEFAULT NULL,
  `agent_code` varchar(32) DEFAULT NULL,
  `real_name` varchar(120) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `contact_phone` varchar(15) DEFAULT NULL,
  `facebook_id` varchar(255) DEFAULT NULL,
  `google_id` varchar(255) DEFAULT NULL,
  `whatsapp` varchar(30) DEFAULT NULL,
  `player_no` bigint unsigned DEFAULT NULL,
  `is_blocked` tinyint(1) NOT NULL DEFAULT 0,
  `is_held` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_phone` (`phone`),
  UNIQUE KEY `uq_users_player_no` (`player_no`),
  KEY `idx_users_referral_code` (`referral_code`),
  KEY `idx_users_agent_code` (`agent_code`),
  KEY `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wallets` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `balance` bigint NOT NULL DEFAULT 0,
  `bonus_balance` bigint NOT NULL DEFAULT 0,
  `turnover_need` bigint NOT NULL DEFAULT 0,
  `turnover_done` bigint NOT NULL DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_wallets_user` (`user_id`),
  CONSTRAINT `fk_wallets_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `transactions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `type` enum('deposit','withdrawal','bonus','bet','win','adjustment') NOT NULL,
  `amount` bigint NOT NULL DEFAULT 0,
  `balance_before` bigint NOT NULL DEFAULT 0,
  `balance_after` bigint NOT NULL DEFAULT 0,
  `kind` varchar(32) DEFAULT NULL,
  `reference` varchar(100) DEFAULT NULL,
  `ref` varchar(100) DEFAULT NULL,
  `status` enum('pending','approved','rejected','completed') NOT NULL DEFAULT 'pending',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_transactions_user` (`user_id`),
  KEY `idx_transactions_status` (`status`),
  CONSTRAINT `fk_transactions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payout_accounts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `method` varchar(40) NOT NULL,
  `account_no` varchar(120) NOT NULL,
  `display_name` varchar(120) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payout_accounts_user` (`user_id`),
  CONSTRAINT `fk_payout_accounts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `account_appeals` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` varchar(255) NOT NULL,
  `message` varchar(500) NOT NULL,
  `state` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `reviewed_by` varchar(255) DEFAULT NULL,
  `admin_note` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_account_appeals_user_created` (`user_id`, `created_at`),
  KEY `idx_account_appeals_state` (`state`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(80) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('super_admin','admin','agent') NOT NULL DEFAULT 'admin',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_admin_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `profiles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `phone` varchar(15) NOT NULL,
  `display_name` varchar(100) DEFAULT NULL,
  `role` enum('player','agent','admin') NOT NULL DEFAULT 'player',
  `vip_level` tinyint unsigned NOT NULL DEFAULT 0,
  `referral_code` varchar(32) DEFAULT NULL,
  `agent_code` varchar(32) DEFAULT NULL,
  `player_no` bigint unsigned DEFAULT NULL,
  `is_blocked` tinyint(1) NOT NULL DEFAULT 0,
  `is_held` tinyint(1) NOT NULL DEFAULT 0,
  `block_reason` varchar(255) DEFAULT NULL,
  `hold_reason` varchar(255) DEFAULT NULL,
  `withdraw_locked` tinyint(1) NOT NULL DEFAULT 0,
  `lock_reason` varchar(255) DEFAULT NULL,
  `locked_at` timestamp NULL DEFAULT NULL,
  `locked_by` varchar(80) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_profiles_phone` (`phone`),
  UNIQUE KEY `uq_profiles_player_no` (`player_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `deposits` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `channel_id` varchar(80) NOT NULL DEFAULT '',
  `amount` bigint NOT NULL DEFAULT 0,
  `sender_no` varchar(30) DEFAULT NULL,
  `txn_id` varchar(120) DEFAULT NULL,
  `state` enum('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  `status` enum('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  `admin_note` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `method_id` varchar(40) DEFAULT NULL,
  `bonus_amount` bigint NOT NULL DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_deposits_user` (`user_id`),
  KEY `idx_deposits_state` (`state`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `withdrawals` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `channel_id` varchar(80) NOT NULL DEFAULT '',
  `amount` bigint NOT NULL DEFAULT 0,
  `account_no` varchar(120) DEFAULT NULL,
  `state` enum('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  `status` enum('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  `admin_note` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `charge_amount` bigint NOT NULL DEFAULT 0,
  `charge_channel_id` varchar(80) DEFAULT NULL,
  `charge_account_no` varchar(120) DEFAULT NULL,
  `charge_trx_id` varchar(120) DEFAULT NULL,
  `charge_paid_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_withdrawals_user` (`user_id`),
  KEY `idx_withdrawals_state` (`state`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `profiles` (`phone`, `display_name`, `role`, `vip_level`, `referral_code`, `agent_code`, `player_no`, `is_blocked`, `is_held`, `block_reason`, `hold_reason`, `withdraw_locked`, `lock_reason`, `locked_at`, `locked_by`, `created_at`)
SELECT `phone`, `display_name`, `role`, `vip_level`, `referral_code`, `agent_code`, `player_no`, `is_blocked`, `is_held`, NULL, NULL, 0, NULL, NULL, NULL, `created_at`
FROM `users`
ON DUPLICATE KEY UPDATE
  `display_name` = VALUES(`display_name`),
  `role` = VALUES(`role`),
  `vip_level` = VALUES(`vip_level`),
  `referral_code` = VALUES(`referral_code`),
  `agent_code` = VALUES(`agent_code`),
  `player_no` = VALUES(`player_no`),
  `is_blocked` = VALUES(`is_blocked`),
  `is_held` = VALUES(`is_held`);

INSERT INTO `admin_users` (`username`, `password_hash`, `role`)
SELECT 'admin', '$2a$12$3GwULUQKSl2v9NnMt9S1hO6td4f9YAOIcgXbyhJvHvL2WGv2x8wre', 'super_admin'
WHERE NOT EXISTS (
  SELECT 1 FROM `admin_users` WHERE `username` = 'admin'
);

INSERT INTO `users` (`phone`, `password_hash`, `display_name`, `role`, `vip_level`, `referral_code`, `agent_code`)
SELECT '01000000000', '$2a$12$3GwULUQKSl2v9NnMt9S1hO6td4f9YAOIcgXbyhJvHvL2WGv2x8wre', 'Demo User', 'player', 0, 'demo', 'demoagent'
WHERE NOT EXISTS (
  SELECT 1 FROM `users` WHERE `phone` = '01000000000'
);

INSERT INTO `wallets` (`user_id`, `balance`, `bonus_balance`, `turnover_need`, `turnover_done`)
SELECT `id`, 0, 0, 0, 0 FROM `users` WHERE `phone` = '01000000000'
ON DUPLICATE KEY UPDATE `balance` = VALUES(`balance`), `bonus_balance` = VALUES(`bonus_balance`);
