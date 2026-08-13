-- Enabled once at cluster init. PostGIS is required (ST_DWithin / ST_Contains);
-- pgvector is enabled now so sprint 2 (CLIP embedding similarity) needs no
-- migration to the DB provisioning. Do NOT fall back to haversine if PostGIS
-- is unavailable — stop and fix the image instead.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;
