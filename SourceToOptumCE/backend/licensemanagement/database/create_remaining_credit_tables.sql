-- Create credit_transactions table if not exists
CREATE TABLE IF NOT EXISTS `credit_transactions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `account_id` int unsigned NOT NULL,
  `package_name` varchar(100) NOT NULL,
  `credits` decimal(10, 2) NOT NULL,
  `amount` decimal(10, 2) NOT NULL,
  `currency` varchar(3) NOT NULL DEFAULT 'USD',
  `status` varchar(50) NOT NULL DEFAULT 'pending',
  `stripe_session_id` varchar(255) DEFAULT NULL,
  `stripe_payment_intent` varchar(255) DEFAULT NULL,
  `metadata` text DEFAULT NULL,
  `created_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_date` timestamp NULL DEFAULT NULL,
  KEY `account_id` (`account_id`),
  KEY `account_id_created_date` (`account_id`, `created_date`),
  KEY `stripe_session_id` (`stripe_session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create credit_usage_logs table if not exists
CREATE TABLE IF NOT EXISTS `credit_usage_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `account_id` int unsigned NOT NULL,
  `resource_type` varchar(50) NOT NULL,
  `resource_id` varchar(100) NOT NULL,
  `credits_used` decimal(10, 2) NOT NULL,
  `description` text DEFAULT NULL,
  `created_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `account_id` (`account_id`),
  KEY `account_id_created_date` (`account_id`, `created_date`),
  KEY `resource_type` (`resource_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ensure account_credits has proper structure
CREATE TABLE IF NOT EXISTS `account_credits` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `account_id` int unsigned NOT NULL,
  `credits` decimal(10, 2) NOT NULL DEFAULT '0.00',
  `credits_used` decimal(10, 2) NOT NULL DEFAULT '0.00',
  `last_purchase_date` timestamp NULL DEFAULT NULL,
  `created_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `account_id` (`account_id`),
  KEY `account_id_idx` (`account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
