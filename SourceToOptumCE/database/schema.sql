-- Adminer 4.8.1 MySQL 5.5.5-10.9.2-MariaDB dump

SET NAMES utf8;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;
SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

SET NAMES utf8mb4;

DROP TABLE IF EXISTS `account`;
CREATE TABLE `account` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `origin` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` int(11) NOT NULL DEFAULT 0 COMMENT '0-individual, 1-organization, 3-university',
  `name` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `domain` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `_last_seen` datetime DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `domain` (`domain`),
  UNIQUE KEY `unique_type_name_domain` (`type`,`name`,`domain`),
  UNIQUE KEY `unique_name_domain` (`name`,`domain`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS `account_group`;
CREATE TABLE `account_group` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `account_id` int(11) NOT NULL,
  `name` varchar(2000) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `account_group_ibfk_1` (`account_id`),
  CONSTRAINT `account_group_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `account` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS `account_member`;
CREATE TABLE `account_member` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `account_id` int(11) NOT NULL,
  `member_id` int(11) NOT NULL,
  `member_role` int(11) NOT NULL DEFAULT 0 COMMENT '0-Normal, 1-Admin',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_link` (`account_id`,`member_id`),
  KEY `account_member_ibfk_1` (`account_id`),
  KEY `account_member_ibfk_2` (`member_id`),
  CONSTRAINT `account_member_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `account` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `account_member_ibfk_2` FOREIGN KEY (`member_id`) REFERENCES `account` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS `account_scheme`;
CREATE TABLE `account_scheme` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `account_id` int(11) NOT NULL,
  `scheme_id` int(11) NOT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `academic_id` (`account_id`),
  KEY `scheme_id` (`scheme_id`),
  CONSTRAINT `account_scheme_ibfk_2` FOREIGN KEY (`scheme_id`) REFERENCES `scheme` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `account_scheme_ibfk_3` FOREIGN KEY (`account_id`) REFERENCES `account` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;


DROP TABLE IF EXISTS `archive`;
CREATE TABLE `archive` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `type` int(11) NOT NULL COMMENT '0-general, 1-seats',
  `license_id` int(11) DEFAULT NULL,
  `account_id` int(11) DEFAULT NULL,
  `start` datetime DEFAULT NULL,
  `end` datetime DEFAULT NULL,
  `first_name` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_name` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `machine` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(2000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `data` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS `assignment`;
CREATE TABLE `assignment` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `license_id` int(11) NOT NULL,
  `account_id` int(11) NOT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `account_id` (`account_id`),
  KEY `assignment_ibfk_1` (`license_id`),
  CONSTRAINT `assignment_ibfk_1` FOREIGN KEY (`license_id`) REFERENCES `license` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `assignment_ibfk_2` FOREIGN KEY (`account_id`) REFERENCES `account` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS `config`;
CREATE TABLE `config` (
  `@key` varchar(250) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`@key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS `group_member`;
CREATE TABLE `group_member` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `group_id` int(11) NOT NULL,
  `account_id` int(11) NOT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `account_id` (`account_id`),
  KEY `group_member_ibfk_2` (`group_id`),
  CONSTRAINT `group_member_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `account` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `group_member_ibfk_2` FOREIGN KEY (`group_id`) REFERENCES `account_group` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS `identity`;
CREATE TABLE `identity` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `origin` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'NOT NULL: create from somewhere else, cannot login',
  `account_id` int(11) DEFAULT NULL,
  `password` varchar(250) COLLATE utf8mb4_unicode_ci NOT NULL,
  `remember_token` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email_validated` bit(1) NOT NULL,
  `role` tinyint(2) NOT NULL COMMENT '0-normal, 1-admin, 2-sale',
  `email` varchar(250) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `first_name` varchar(250) CHARACTER SET latin1 NOT NULL,
  `last_name` varchar(250) CHARACTER SET latin1 NOT NULL,
  `organization` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `title` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `street` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `street_number` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `city` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `zipcode` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `region` varchar(2000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `country` varchar(250) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone_number` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `two_factor_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `avatar` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subscribe_email` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `user_name` (`user_name`),
  KEY `account_id` (`account_id`),
  CONSTRAINT `identity_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `account` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `identity_ibfk_2` FOREIGN KEY (`email`) REFERENCES `account` (`name`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS `invitation`;
CREATE TABLE `invitation` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `account_id` int(11) NOT NULL,
  `data` varchar(250) NOT NULL,
  `isNewUser` tinyint(1) NOT NULL,
  `code` varchar(250) NOT NULL,
  `as_admin` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Invite user to be admin',
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_pending_email` (`data`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


DROP TABLE IF EXISTS `ip_data`;
CREATE TABLE `ip_data` (
  `ip` varchar(250) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider` int(11) NOT NULL COMMENT '0-ipstack, 1-ipdata',
  `data` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `update_date` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`ip`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS `license`;
CREATE TABLE `license` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `owner_id` int(11) DEFAULT NULL,
  `link_id` int(11) DEFAULT NULL,
  `product_id` int(11) NOT NULL,
  `seat_limit` int(11) NOT NULL,
  `user_seat_limit` int(11) NOT NULL,
  `node_limit` int(11) NOT NULL,
  `instance_limit` int(11) NOT NULL DEFAULT 1,
  `life_cycle` tinyint(2) NOT NULL COMMENT '0-Time limited, 1-Perpetual',
  `support_until` datetime DEFAULT NULL,
  `releases` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expiry_date` datetime NOT NULL,
  `scheme_id` int(11) DEFAULT NULL,
  `lease_duration` int(11) DEFAULT NULL COMMENT 'in seconds',
  `features` varchar(1000) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL COMMENT 'List of features attached to this license.Comma splitter ',
  `type` tinyint(2) NOT NULL COMMENT '0-named user, 1-floating',
  `can_renewal` tinyint(1) DEFAULT NULL,
  `auto_renewal` tinyint(1) DEFAULT 0,
  `assignment_policy` tinyint(2) DEFAULT NULL COMMENT '0-owner, 1-domains, 2-emails, 3-external',
  `automatic_assign` tinyint(1) DEFAULT 1 COMMENT 'Applied if assignment_policy=1',
  `arbitrary_domain` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Applied if assignment_policy=1',
  `assignment_policy_data` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `watermark` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'display watermark on application',
  `version_limit` varchar(25) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'controlling version',
  `description` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `text` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `order_id` int(11) DEFAULT NULL COMMENT 'the order_id of Commercial license',
  `_lease_until` datetime DEFAULT NULL,
  `notif` tinyint(1) DEFAULT NULL,
  `notif_emails` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notif_text` mediumtext COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notif_option` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notif_sent` datetime DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `sys_data` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `logs` mediumtext COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`),
  KEY `owner_id` (`owner_id`),
  KEY `scheme_id` (`scheme_id`),
  KEY `link_id` (`link_id`),
  CONSTRAINT `license_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `license_ibfk_2` FOREIGN KEY (`owner_id`) REFERENCES `account` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `license_ibfk_3` FOREIGN KEY (`scheme_id`) REFERENCES `scheme` (`id`),
  CONSTRAINT `license_ibfk_4` FOREIGN KEY (`link_id`) REFERENCES `account_member` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS `node`;
CREATE TABLE `node` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `license_id` int(11) NOT NULL,
  `account_id` int(11) NOT NULL,
  `machine` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `license_id` (`license_id`),
  KEY `account_id` (`account_id`),
  CONSTRAINT `node_ibfk_1` FOREIGN KEY (`license_id`) REFERENCES `license` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `node_ibfk_3` FOREIGN KEY (`account_id`) REFERENCES `account` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS `notification`;
CREATE TABLE `notification` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `type` tinyint(4) NOT NULL DEFAULT 0 COMMENT '0:Show product 1:Download now',
  `icon` varchar(255) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `body` varchar(255) DEFAULT NULL,
  `member_id` int(11) DEFAULT NULL,
  `ext_data` text DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


DROP TABLE IF EXISTS `otk`;
CREATE TABLE `otk` (
  `code` varchar(100) NOT NULL,
  `status` smallint(6) DEFAULT NULL,
  `data` mediumtext DEFAULT NULL,
  `created_date` datetime DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;


DROP TABLE IF EXISTS `password_resets`;
CREATE TABLE `password_resets` (
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  KEY `passwords_resets_email_index` (`email`),
  KEY `passwords_resets_token_index` (`token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS `product`;
CREATE TABLE `product` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `name` varchar(25) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `description` varchar(250) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `download_link` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS `product_release`;
CREATE TABLE `product_release` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `name` varchar(250) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `start_date` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `product_release_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS `scheme`;
CREATE TABLE `scheme` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `name` varchar(500) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `can_renewal` tinyint(1) DEFAULT NULL,
  `description` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `seat_limit` int(11) DEFAULT 1,
  `user_seat_limit` int(11) NOT NULL DEFAULT 1,
  `node_limit` int(11) NOT NULL DEFAULT 2,
  `instance_limit` int(11) NOT NULL DEFAULT 1,
  `type` tinyint(2) NOT NULL DEFAULT 0 COMMENT '0-named user, 1-floating',
  `kind` tinyint(2) NOT NULL DEFAULT 0 COMMENT '0-Trial, 1-Academic, 2-Commercial, 3-Custom Academic, 4-Unlisted',
  `assignment_policy` tinyint(2) NOT NULL DEFAULT 0 COMMENT '0-owner, 1-domains, 2-emails, 3-external',
  `validity` int(11) DEFAULT NULL COMMENT 'in days',
  `features` varchar(1000) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `text` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `scheme_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS `seat`;
CREATE TABLE `seat` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `assignment_id` int(11) NOT NULL,
  `node_id` int(11) NOT NULL,
  `lease_since` datetime NOT NULL DEFAULT current_timestamp(),
  `lease_until` datetime NOT NULL DEFAULT current_timestamp(),
  `user_agent` varchar(2000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `update_date` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `node_id` (`node_id`),
  KEY `assignment_id` (`assignment_id`),
  CONSTRAINT `seat_ibfk_1` FOREIGN KEY (`node_id`) REFERENCES `node` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `seat_ibfk_2` FOREIGN KEY (`assignment_id`) REFERENCES `assignment` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS `session_stat`;
CREATE TABLE `session_stat` (
  `seat_id` int(11) NOT NULL,
  `license_id` int(11) NOT NULL,
  `account_id` int(11) NOT NULL,
  `node_id` int(11) NOT NULL,
  `start_time` datetime NOT NULL,
  `hb_time` datetime NOT NULL,
  `end_time` datetime DEFAULT NULL,
  PRIMARY KEY (`seat_id`),
  KEY `license_id` (`license_id`),
  KEY `account_id` (`account_id`),
  KEY `node_id` (`node_id`),
  CONSTRAINT `session_stat_ibfk_1` FOREIGN KEY (`license_id`) REFERENCES `license` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `session_stat_ibfk_2` FOREIGN KEY (`account_id`) REFERENCES `account` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `session_stat_ibfk_3` FOREIGN KEY (`node_id`) REFERENCES `node` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;


DROP TABLE IF EXISTS `test_dt`;
CREATE TABLE `test_dt` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `t1` datetime NOT NULL DEFAULT current_timestamp(),
  `t2` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;


DROP TABLE IF EXISTS `tokens`;
CREATE TABLE `tokens` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `member_id` int(10) unsigned NOT NULL,
  `used` tinyint(1) NOT NULL DEFAULT 0,
  `extension_data` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


DROP TABLE IF EXISTS `user_location`;
CREATE TABLE `user_location` (
  `identity_id` int(11) NOT NULL,
  `first_country` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `first_city` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `first_product_id` int(11) DEFAULT NULL,
  `last_country` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_city` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_product_id` int(11) DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `update_date` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`identity_id`),
  CONSTRAINT `user_location_ibfk_1` FOREIGN KEY (`identity_id`) REFERENCES `identity` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 2025-11-05 11:13:17
