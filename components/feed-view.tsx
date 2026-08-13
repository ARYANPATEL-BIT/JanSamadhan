"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { categoryEmoji, categoryLabel } from "@/lib/categories";

interface FeedItem {
  id: string;
  category: string;
  status: string;
  lng: number;
  lat: number;
  upvoteCount: number;
  createdAt: string;
  wardNo: number | null;
  municipalityName: string | null;
  thumbnailUrl: string | null;
  viewerUpvoted: boolean;
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

function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function FeedView({ items, authed }: { items: FeedItem[]; authed: boolean }) {
  const [tab, setTab] = useState<"list" | "map">("list");
  const [rows, setRows] = useState(items);

  async function upvote(id: string) {
    if (!authed) {
      toast.error("Log in to upvote.");
      return;
    }
    // optimistic
    setRows((rs) =>
      rs.map((r) =>
        r.id === id
          ? {
              ...r,
              viewerUpvoted: !r.viewerUpvoted,
              upvoteCount: r.upvoteCount + (r.viewerUpvoted ? -1 : 1),
            }
          : r,
      ),
    );
    const res = await fetch(`/api/v1/reports/${id}/upvote`, { method: "POST" });
    if (!res.ok) {
      toast.error("Upvote failed.");
      setRows(items);
      return;
    }
    const data = (await res.json()) as { upvoted: boolean; count: number };
    setRows((rs) =>
      rs.map((r) =>
        r.id === id ? { ...r, viewerUpvoted: data.upvoted, upvoteCount: data.count } : r,
      ),
    );
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-md border p-0.5 text-sm">
        <button
          onClick={() => setTab("list")}
          className={`rounded px-3 py-1 ${tab === "list" ? "bg-muted font-medium" : ""}`}
        >
          List
        </button>
        <button
          onClick={() => setTab("map")}
          className={`rounded px-3 py-1 ${tab === "map" ? "bg-muted font-medium" : ""}`}
        >
          Map
        </button>
      </div>

      {tab === "map" ? (
        <FeedMap items={rows} />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="flex gap-3 rounded-lg border p-3">
              <Link href={`/report/${r.id}`} className="shrink-0">
                {r.thumbnailUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={r.thumbnailUrl}
                    alt={r.category}
                    className="h-20 w-20 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-md bg-muted text-2xl">
                    {categoryEmoji(r.category)}
                  </div>
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/report/${r.id}`} className="font-medium hover:underline">
                  {categoryEmoji(r.category)} {categoryLabel(r.category)}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{r.status}</Badge>
                  <span>
                    {r.municipalityName
                      ? `Ward ${r.wardNo}, ${r.municipalityName}`
                      : "Unmapped area"}
                  </span>
                  <span>· {timeAgo(r.createdAt)}</span>
                </div>
              </div>
              <button
                onClick={() => upvote(r.id)}
                className={`flex flex-col items-center rounded-md border px-3 py-1 text-sm ${
                  r.viewerUpvoted ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"
                }`}
                aria-pressed={r.viewerUpvoted}
              >
                <span>▲</span>
                <span className="tabular-nums">{r.upvoteCount}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FeedMap({ items }: { items: FeedItem[] }) {
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
      const el = document.createElement("div");
      el.textContent = categoryEmoji(it.category);
      el.style.fontSize = "22px";
      el.style.cursor = "pointer";
      new maplibregl.Marker({ element: el })
        .setLngLat([it.lng, it.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 24 }).setHTML(
            `<strong>${categoryLabel(it.category)}</strong><br/>${it.status} · ▲ ${it.upvoteCount}<br/><a href="/report/${it.id}">Open</a>`,
          ),
        )
        .addTo(map);
    }

    return () => map.remove();
  }, [items]);

  return <div ref={ref} className="h-[70vh] w-full overflow-hidden rounded-lg border" />;
}
