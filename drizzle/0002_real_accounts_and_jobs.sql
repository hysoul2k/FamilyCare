CREATE TRIGGER credentials_active_family BEFORE INSERT ON credentials WHEN NOT EXISTS(SELECT 1 FROM families WHERE id=NEW.family_id) BEGIN SELECT RAISE(ABORT,'Family no longer exists'); END;
