-- Seed: Ranchi Municipal Corporation (Jharkhand) with 3 hand-drawn ward
-- polygons around the real city centre (~23.34 N, 85.31 E), the departments,
-- and the full category→department routing map (PRD §9.6).
--
-- Ward polygons are simple adjacent rectangles good enough for point-in-polygon
-- ward lookup in the demo. Production onboarding replaces these with real OSM
-- boundary GeoJSON per city (a data-ingestion task, not a code change).
--
-- Idempotent: re-running replaces the seed muni (cascades to wards, departments,
-- category_department_map). Will fail if reports already reference these rows —
-- that's intentional; wipe reports first if you need to re-seed.

DELETE FROM municipalities WHERE name = 'Ranchi Municipal Corporation';

DO $$
DECLARE
  m_id uuid;
  d_roads uuid;
  d_san uuid;
  d_light uuid;
  d_drain uuid;
BEGIN
  INSERT INTO municipalities (name, state, boundary)
  VALUES (
    'Ranchi Municipal Corporation', 'Jharkhand',
    ST_GeogFromText('SRID=4326;POLYGON((85.30 23.32, 85.34 23.32, 85.34 23.36, 85.30 23.36, 85.30 23.32))')
  )
  RETURNING id INTO m_id;

  -- Ward 1 — west-central
  INSERT INTO wards (municipality_id, ward_no, boundary) VALUES (
    m_id, 1,
    ST_GeogFromText('SRID=4326;POLYGON((85.30 23.34, 85.32 23.34, 85.32 23.36, 85.30 23.36, 85.30 23.34))')
  );
  -- Ward 2 — east-central
  INSERT INTO wards (municipality_id, ward_no, boundary) VALUES (
    m_id, 2,
    ST_GeogFromText('SRID=4326;POLYGON((85.32 23.34, 85.34 23.34, 85.34 23.36, 85.32 23.36, 85.32 23.34))')
  );
  -- Ward 3 — south
  INSERT INTO wards (municipality_id, ward_no, boundary) VALUES (
    m_id, 3,
    ST_GeogFromText('SRID=4326;POLYGON((85.30 23.32, 85.34 23.32, 85.34 23.34, 85.30 23.34, 85.30 23.32))')
  );

  INSERT INTO departments (municipality_id, name, contact) VALUES
    (m_id, 'Roads & Infrastructure', 'roads@ranchimc.example')  RETURNING id INTO d_roads;
  INSERT INTO departments (municipality_id, name, contact) VALUES
    (m_id, 'Sanitation & Solid Waste', 'sanitation@ranchimc.example') RETURNING id INTO d_san;
  INSERT INTO departments (municipality_id, name, contact) VALUES
    (m_id, 'Street Lighting', 'lighting@ranchimc.example') RETURNING id INTO d_light;
  INSERT INTO departments (municipality_id, name, contact) VALUES
    (m_id, 'Drainage & Water', 'drainage@ranchimc.example') RETURNING id INTO d_drain;

  -- category → department + SLA (hours). Defaults per §4.3.
  INSERT INTO category_department_map (municipality_id, category, department_id, sla_hours) VALUES
    (m_id, 'pothole',          d_roads, 168),
    (m_id, 'broken_footpath',  d_roads, 168),
    (m_id, 'damaged_signage',  d_roads, 120),
    (m_id, 'fallen_tree',      d_roads, 48),
    (m_id, 'garbage_dump',     d_san,   48),
    (m_id, 'illegal_dumping',  d_san,   72),
    (m_id, 'stray_animal',     d_san,   96),
    (m_id, 'other',            d_san,   168),
    (m_id, 'streetlight_out',  d_light, 72),
    (m_id, 'waterlogging',     d_drain, 24),
    (m_id, 'open_drain',       d_drain, 72);
END $$;
