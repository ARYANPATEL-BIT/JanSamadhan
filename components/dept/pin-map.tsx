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

export function PinMap({ lng, lat }: { lng: number; lat: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: OSM_STYLE,
      center: [lng, lat],
      zoom: 16,
    });
    new maplibregl.Marker().setLngLat([lng, lat]).addTo(map);
    return () => map.remove();
  }, [lng, lat]);
  return (
    <div ref={ref} style={{ height: "220px", width: "100%", border: "1px solid var(--gov-border)" }} />
  );
}
