# PostGIS base (Debian, with the official PGDG apt repo already configured)
# plus pgvector installed from the PGDG packages, so a single Postgres instance
# serves both ST_DWithin (duplicate detection / ward lookup) and vector(512)
# (CLIP embedding similarity, sprint 2).
FROM postgis/postgis:16-3.4

RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-16-pgvector \
    && rm -rf /var/lib/apt/lists/*
