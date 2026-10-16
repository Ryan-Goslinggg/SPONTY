-- Profile locations are now stored at ~1km precision (2 decimals) so nobody's
-- home can be pinpointed from their profile. Coarsen rows saved before that.
UPDATE "profiles"
SET "lat" = round("lat"::numeric, 2)::double precision,
    "lng" = round("lng"::numeric, 2)::double precision
WHERE "lat" <> round("lat"::numeric, 2)::double precision
   OR "lng" <> round("lng"::numeric, 2)::double precision;
