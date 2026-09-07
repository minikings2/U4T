-- ВНИМАНИЕ: ДЕСТРУКТИВНАЯ ОПЕРАЦИЯ.
-- Полностью очищает пользовательские данные urfu4tour, но сохраняет структуру таблиц.
-- Перед выполнением убедитесь, что выбрана база urfu4onlin.

SET FOREIGN_KEY_CHECKS=0;
DELETE FROM email_codes;
DELETE FROM chat_messages;
DELETE FROM trip_bookings;
DELETE FROM future_trips;
DELETE FROM driver_locations;
DELETE FROM ratings;
DELETE FROM rides;
DELETE FROM users;
SET FOREIGN_KEY_CHECKS=1;

ALTER TABLE email_codes AUTO_INCREMENT=1;
ALTER TABLE chat_messages AUTO_INCREMENT=1;
ALTER TABLE trip_bookings AUTO_INCREMENT=1;
ALTER TABLE future_trips AUTO_INCREMENT=1;
ALTER TABLE ratings AUTO_INCREMENT=1;
ALTER TABLE rides AUTO_INCREMENT=1;
ALTER TABLE users AUTO_INCREMENT=1;

SELECT 'urfu4tour: база очищена' AS result;
