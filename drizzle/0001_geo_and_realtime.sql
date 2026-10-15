-- Radius queries for the Find map. earthdistance models the earth as a sphere,
-- which is plenty accurate for a 250m circle and is available on Neon and stock Postgres.
CREATE EXTENSION IF NOT EXISTS cube;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS earthdistance;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviews_earth_idx" ON "reviews" USING gist (ll_to_earth("lat", "lng"));
--> statement-breakpoint
-- Lets "people near me" use a KNN index scan (ORDER BY ll_to_earth(...) <-> ...).
CREATE INDEX IF NOT EXISTS "profiles_earth_idx" ON "profiles" USING gist (ll_to_earth("lat", "lng"));
--> statement-breakpoint

-- Realtime: every new message or friendship is announced on one channel.
-- The app's event stream LISTENs and forwards each event to the users in "to".
-- Payloads stay far below NOTIFY's 8000 byte limit because message text is capped at 1000 characters.
CREATE OR REPLACE FUNCTION sponty_notify_message() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('sponty_events', json_build_object(
    'type', 'message',
    'to', json_build_array(NEW.sender_id, NEW.recipient_id),
    'message', json_build_object(
      'id', NEW.id,
      'senderId', NEW.sender_id,
      'recipientId', NEW.recipient_id,
      'text', NEW.text,
      'createdAt', (extract(epoch from NEW.created_at) * 1000)::bigint
    )
  )::text);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER messages_notify AFTER INSERT ON "messages"
  FOR EACH ROW EXECUTE FUNCTION sponty_notify_message();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION sponty_notify_friendship() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('sponty_events', json_build_object(
    'type', 'friend',
    'to', json_build_array(NEW.user_id),
    'friendId', NEW.friend_id
  )::text);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER friendships_notify AFTER INSERT ON "friendships"
  FOR EACH ROW EXECUTE FUNCTION sponty_notify_friendship();
