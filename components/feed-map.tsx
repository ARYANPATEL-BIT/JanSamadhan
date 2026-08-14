"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTranslations } from "next-intl";

interface FeedItem {
  id: string;
  category: string;
  status: string;
  lng: number;
  lat: number;
  upvoteCount: number;
}

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

export function FeedMap({ items }: { items: FeedItem[] }) {
  const tc = useTranslations("categories");
  const ts = useTranslations("status");
  const t = useTranslations("feed");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const first = items[0];
    const map = new maplibregl.Map({
      container: ref.current,
      style: OSM_STYLE,
      center: first ? [first.lng, first.lat] : [78.9629, 20.5937],
      zoom: first ? 13 : 4,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    for (const it of items) {
      new maplibregl.Marker()
        .setLngLat([it.lng, it.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 24 }).setHTML(
            `<strong>${tc(it.category)}</strong><br/>${ts(it.status)} · ▲ ${it.upvoteCount}<br/><a href="/report/${it.id}">${t("viewDetails")}</a>`,
          ),
        )
        .addTo(map);
    }

    return () => map.remove();
  }, [items, tc, ts, t]);

  return (
    <div
      ref={ref}
      style={{
        height: "70vh",
        width: "100%",
        border: "1px solid var(--gov-border)",
        overflow: "hidden",
      }}
    />
  );
}
