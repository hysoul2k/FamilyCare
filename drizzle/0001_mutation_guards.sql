CREATE INDEX records_family_kind ON records(family_id, kind, created_at);
--> statement-breakpoint
CREATE INDEX events_family_time ON events(family_id, captured_at);
--> statement-breakpoint
CREATE TRIGGER events_active_device BEFORE INSERT ON events
WHEN NOT EXISTS (SELECT 1 FROM records r JOIN credentials c ON c.device_id=r.id JOIN families f ON f.id=r.family_id WHERE r.id=NEW.device_id AND r.family_id=NEW.family_id AND r.kind='device' AND c.revoked_at IS NULL AND json_extract(r.data,'$.status') IS NOT 'revoked')
BEGIN SELECT RAISE(ABORT,'Device credential inactive'); END;
--> statement-breakpoint
CREATE TRIGGER pairings_active_family BEFORE INSERT ON pairings
WHEN NOT EXISTS (SELECT 1 FROM families WHERE id=NEW.family_id)
BEGIN SELECT RAISE(ABORT,'Family no longer exists'); END;
--> statement-breakpoint
CREATE TRIGGER records_active_family BEFORE INSERT ON records
WHEN NOT EXISTS (SELECT 1 FROM families WHERE id=NEW.family_id)
BEGIN SELECT RAISE(ABORT,'Family no longer exists'); END;
