"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

export function FieldTaskMap({
  items,
}: {
  items: { id: string; lng: number; lat: number; category: string }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || items.length === 0) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: OSM_STYLE,
      center: [items[0].lng, items[0].lat],
      zoom: 13,
    });
    for (const it of items) {
      new maplibregl.Marker().setLngLat([it.lng, it.lat]).addTo(map);
    }
    return () => map.remove();
  }, [items]);
  return (
    <div ref={ref} style={{ height: "280px", width: "100%", border: "1px solid var(--gov-border)" }} />
  );
}
