-- Run as the Supabase project database owner. No user data is seeded.
-- Application identity remains in this private schema, separate from auth.users.
BEGIN;
CREATE SCHEMA IF NOT EXISTS family_care;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='fc_backend') THEN
  CREATE ROLE fc_backend NOLOGIN NOINHERIT;
 END IF;
 -- Supabase's project owner is not a superuser. PG16+ does not grant
 -- SET ROLE automatically when CREATEROLE creates the restricted owner.
 EXECUTE format('GRANT fc_backend TO %I WITH INHERIT TRUE, SET TRUE',current_user);
END $$;
CREATE TABLE IF NOT EXISTS family_care.accounts(id text PRIMARY KEY,email text NOT NULL UNIQUE,display_name text NOT NULL,password_hash text NOT NULL,created_at bigint NOT NULL);
CREATE TABLE IF NOT EXISTS family_care.families(id text PRIMARY KEY,owner_id text NOT NULL UNIQUE REFERENCES family_care.accounts(id),name text NOT NULL,created_at bigint NOT NULL);
CREATE TABLE IF NOT EXISTS family_care.records(id text PRIMARY KEY,family_id text NOT NULL REFERENCES family_care.families(id),kind text NOT NULL,data text NOT NULL CHECK(jsonb_typeof(data::jsonb)='object'),created_at bigint NOT NULL);
CREATE TABLE IF NOT EXISTS family_care.pairings(token_hash text PRIMARY KEY,family_id text NOT NULL REFERENCES family_care.families(id),child_id text NOT NULL,expires_at bigint NOT NULL,consumed_at bigint);
CREATE TABLE IF NOT EXISTS family_care.credentials(token_hash text PRIMARY KEY,device_id text NOT NULL,family_id text NOT NULL REFERENCES family_care.families(id),revoked_at bigint);
CREATE TABLE IF NOT EXISTS family_care.events(id text PRIMARY KEY,device_id text NOT NULL,family_id text NOT NULL REFERENCES family_care.families(id),event_id text NOT NULL,kind text NOT NULL,captured_at bigint NOT NULL,payload text NOT NULL CHECK(jsonb_typeof(payload::jsonb)='object'),UNIQUE(device_id,event_id));
CREATE TABLE IF NOT EXISTS family_care.sessions(token_hash text PRIMARY KEY,user_id text NOT NULL REFERENCES family_care.accounts(id) ON DELETE CASCADE,expires_at bigint NOT NULL,created_at bigint NOT NULL);
CREATE TABLE IF NOT EXISTS family_care.rate_limits(key text PRIMARY KEY,count bigint NOT NULL,reset_at bigint NOT NULL);
CREATE TABLE IF NOT EXISTS family_care.service_state(key text PRIMARY KEY,value text NOT NULL);
CREATE INDEX IF NOT EXISTS records_family_kind ON family_care.records(family_id,kind,created_at);
CREATE INDEX IF NOT EXISTS events_family_time ON family_care.events(family_id,device_id,kind,captured_at);

CREATE OR REPLACE FUNCTION family_care.json_set(document text,pairs jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE result jsonb:=document::jsonb; pair jsonb; path text[];
BEGIN
 FOR pair IN SELECT value FROM jsonb_array_elements(pairs) LOOP
  IF pair->>0 !~ '^\$\.[A-Za-z0-9_.]+$' THEN RAISE EXCEPTION 'Invalid JSON path'; END IF;
  path:=string_to_array(substring(pair->>0 FROM 3),'.');
  result:=jsonb_set(result,path,coalesce(pair->1,'null'::jsonb),true);
 END LOOP;
 RETURN result::text;
END $$;

CREATE OR REPLACE FUNCTION family_care.guard_event() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,family_care AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM family_care.records r JOIN family_care.credentials c ON c.device_id=r.id AND c.family_id=r.family_id WHERE r.id=NEW.device_id AND r.family_id=NEW.family_id AND r.kind='device' AND c.revoked_at IS NULL AND r.data::jsonb->>'status' IS DISTINCT FROM 'revoked') THEN
  RAISE EXCEPTION 'Device credential inactive';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS events_active_device ON family_care.events;
CREATE TRIGGER events_active_device BEFORE INSERT ON family_care.events FOR EACH ROW EXECUTE FUNCTION family_care.guard_event();

-- Backend-owned tables are not available to browser/mobile Data API clients.
REVOKE ALL ON SCHEMA family_care FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA family_care FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA family_care FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA family_care TO fc_backend;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA family_care TO fc_backend;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA family_care TO fc_backend;
DO $$ DECLARE item record; BEGIN
 FOR item IN SELECT tablename FROM pg_tables WHERE schemaname='family_care' LOOP
  EXECUTE format('ALTER TABLE family_care.%I ENABLE ROW LEVEL SECURITY',item.tablename);
  EXECUTE format('DROP POLICY IF EXISTS backend_only ON family_care.%I',item.tablename);
  EXECUTE format('CREATE POLICY backend_only ON family_care.%I TO fc_backend USING(true) WITH CHECK(true)',item.tablename);
 END LOOP;
END $$;

-- Internal HTTPS bridge: only the trusted backend's secret/service-role key
-- may invoke this function. Never grant it to anon or authenticated.
CREATE OR REPLACE FUNCTION public.fc_execute(statements jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,family_care,pg_temp
SET statement_timeout='15s'
AS $$
DECLARE item jsonb; query text; result jsonb:='[]'::jsonb; rows jsonb; affected bigint; mutating boolean;
BEGIN
 IF jsonb_typeof(statements)!='array' OR jsonb_array_length(statements) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Invalid statement batch'; END IF;
 SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(statements) s WHERE upper(ltrim(s->>'sql')) NOT LIKE 'SELECT %') INTO mutating;
 -- Serialize writes across all instances, preserving existing single-writer
 -- enrollment/CAS/revocation semantics. The lock releases at transaction end.
 IF mutating THEN PERFORM pg_advisory_xact_lock(71020261118); END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(statements) LOOP
  query:=item->>'sql';
  IF query IS NULL OR query !~* '^(SELECT|INSERT|UPDATE|DELETE)\s' OR query LIKE '%;%' OR jsonb_typeof(item->'params')!='array' THEN RAISE EXCEPTION 'Unsupported database statement'; END IF;
  IF query ~* '^SELECT\s' THEN
   EXECUTE 'SELECT coalesce(jsonb_agg(to_jsonb(fc_row)),''[]''::jsonb) FROM ('||query||') fc_row' INTO rows USING item->'params';
   affected:=jsonb_array_length(rows);
  ELSE
   EXECUTE query USING item->'params';
   GET DIAGNOSTICS affected=ROW_COUNT;
   rows:='[]'::jsonb;
  END IF;
  result:=result||jsonb_build_array(jsonb_build_object('results',rows,'meta',jsonb_build_object('changes',affected)));
 END LOOP;
 RETURN result;
END $$;
-- Restrict the definer to application tables, not the project-owner role.
GRANT CREATE ON SCHEMA public TO fc_backend;
ALTER FUNCTION public.fc_execute(jsonb) OWNER TO fc_backend;
REVOKE CREATE ON SCHEMA public FROM fc_backend;
REVOKE ALL ON FUNCTION public.fc_execute(jsonb) FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT EXECUTE ON FUNCTION public.fc_execute(jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
