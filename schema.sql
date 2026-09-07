
CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `client_uuid` VARCHAR(36) NOT NULL,
  `username` VARCHAR(100) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('passenger', 'driver', 'superadmin') NOT NULL DEFAULT 'passenger',
  `auth_version` INT UNSIGNED NOT NULL DEFAULT 1,
  `rating` DECIMAL(3,2) NOT NULL DEFAULT 0.00,`last_seen_at` DATETIME DEFAULT NULL,
  `avatar_url` VARCHAR(255) DEFAULT NULL,
  `full_name` VARCHAR(150) DEFAULT NULL,
  `phone` VARCHAR(50) DEFAULT NULL,
  `email` VARCHAR(190) DEFAULT NULL,
  `email_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `email_verified_at` DATETIME DEFAULT NULL,
  `max_contact` VARCHAR(255) DEFAULT NULL,
  `vk_contact` VARCHAR(255) DEFAULT NULL,
  `telegram_contact` VARCHAR(255) DEFAULT NULL,
  `bio` VARCHAR(500) DEFAULT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  UNIQUE KEY `uk_client_uuid` (`client_uuid`),
  INDEX `idx_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `rides` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `client_uuid` VARCHAR(36) NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `driver_id` BIGINT UNSIGNED DEFAULT NULL,
  `lat` DECIMAL(10,8) NOT NULL,
  `lng` DECIMAL(11,8) NOT NULL,
  `pickup_address` VARCHAR(255) DEFAULT NULL,
  `destination_lat` DECIMAL(10,8) DEFAULT NULL,
  `destination_lng` DECIMAL(11,8) DEFAULT NULL,
  `destination_text` VARCHAR(255) DEFAULT NULL,
  `comment` TEXT,
  `status` ENUM('pending', 'accepted', 'on_the_way', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  `pickup_requested_at` DATETIME DEFAULT NULL,
  `pickup_confirmed_at` DATETIME DEFAULT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_client_uuid` (`client_uuid`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_driver_id` (`driver_id`),
  INDEX `idx_status` (`status`),
  CONSTRAINT `fk_rides_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `chat_messages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `client_uuid` VARCHAR(36) NOT NULL,
  `ride_client_uuid` VARCHAR(36) NOT NULL,
  `sender_id` BIGINT UNSIGNED NOT NULL,
  `recipient_id` BIGINT UNSIGNED DEFAULT NULL,
  `message` TEXT NOT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `read_at` DATETIME DEFAULT NULL,
  `deleted_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_client_uuid` (`client_uuid`),
  INDEX `idx_ride_uuid` (`ride_client_uuid`),
  INDEX `idx_sender` (`sender_id`),
  INDEX `idx_recipient` (`recipient_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ratings` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `client_uuid` VARCHAR(36) NOT NULL,
  `from_user_id` BIGINT UNSIGNED NOT NULL,
  `to_user_id` BIGINT UNSIGNED NOT NULL,
  `ride_client_uuid` VARCHAR(36) DEFAULT NULL,
  `score` TINYINT UNSIGNED NOT NULL,
  `review_text` TEXT,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_client_uuid` (`client_uuid`),
  INDEX `idx_to_user` (`to_user_id`),
  INDEX `idx_rating_ride` (`ride_client_uuid`),
  UNIQUE KEY `uk_rating_from_to_ride` (`from_user_id`,`to_user_id`,`ride_client_uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;-- Выполнить один раз в базе urfu4onlin.
ALTER TABLE `rides` MODIFY `status` ENUM('pending','accepted','on_the_way','completed','cancelled') NOT NULL DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS `future_trips` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `driver_id` BIGINT UNSIGNED NOT NULL,
  `origin` VARCHAR(255) NOT NULL,
  `destination` VARCHAR(255) NOT NULL,
  `origin_lat` DECIMAL(10,8) DEFAULT NULL,
  `origin_lng` DECIMAL(11,8) DEFAULT NULL,
  `destination_lat` DECIMAL(10,8) DEFAULT NULL,
  `destination_lng` DECIMAL(11,8) DEFAULT NULL,
  `departure_at` DATETIME NOT NULL,
  `seats_total` TINYINT UNSIGNED NOT NULL,
  `price` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `comment` VARCHAR(500) DEFAULT NULL,
  `status` ENUM('open','closed','completed','cancelled') NOT NULL DEFAULT 'open',
  `repeat_group` VARCHAR(80) DEFAULT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_future_driver` (`driver_id`),
  INDEX `idx_future_departure` (`departure_at`),
  INDEX `idx_future_repeat_group` (`repeat_group`),
  CONSTRAINT `fk_future_driver` FOREIGN KEY (`driver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `trip_bookings` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `trip_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `status` ENUM('booked','cancelled') NOT NULL DEFAULT 'booked',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_trip_user` (`trip_id`,`user_id`),
  INDEX `idx_booking_user` (`user_id`),
  CONSTRAINT `fk_booking_trip` FOREIGN KEY (`trip_id`) REFERENCES `future_trips` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_booking_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `driver_locations` (
  `driver_id` BIGINT UNSIGNED NOT NULL,
  `lat` DECIMAL(10,8) NOT NULL,
  `lng` DECIMAL(11,8) NOT NULL,
  `accuracy` DECIMAL(10,2) DEFAULT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`driver_id`),
  INDEX `idx_driver_location_updated` (`updated_at`),
  CONSTRAINT `fk_driver_location_user` FOREIGN KEY (`driver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_locations` (
  `user_id` BIGINT UNSIGNED NOT NULL,
  `lat` DECIMAL(10,8) NOT NULL,
  `lng` DECIMAL(11,8) NOT NULL,
  `accuracy` DECIMAL(10,2) DEFAULT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`user_id`),
  INDEX `idx_user_location_updated` (`updated_at`),
  CONSTRAINT `fk_user_location_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `email_codes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(190) NOT NULL,
  `type` ENUM('verify','reset') NOT NULL,
  `code` VARCHAR(255) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `attempts` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL,
  `used_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`), INDEX `idx_email_code_lookup` (`email`,`type`,`expires_at`,`used_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;