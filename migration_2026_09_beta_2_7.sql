-- BETA-2.7 — подтверждение подбора пассажира.
-- Выполнить один раз в базе проекта.

ALTER TABLE `rides`
  ADD COLUMN `pickup_requested_at` DATETIME DEFAULT NULL AFTER `status`,
  ADD COLUMN `pickup_confirmed_at` DATETIME DEFAULT NULL AFTER `pickup_requested_at`;

ALTER TABLE `rides`
  ADD INDEX `idx_pickup_requested` (`pickup_requested_at`);
