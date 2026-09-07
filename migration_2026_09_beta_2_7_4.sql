-- BETA-2.7.4 — отзыв после каждой поездки, а не один на пользователя.
-- Выполнить один раз в базе проекта.

ALTER TABLE `ratings`
  ADD COLUMN `ride_client_uuid` VARCHAR(36) DEFAULT NULL AFTER `to_user_id`,
  ADD INDEX `idx_rating_ride` (`ride_client_uuid`),
  ADD UNIQUE KEY `uk_rating_from_to_ride` (`from_user_id`,`to_user_id`,`ride_client_uuid`);
