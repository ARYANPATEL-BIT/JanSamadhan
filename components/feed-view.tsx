"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusClass(status: string): string {
  const s = status.toLowerCase().replace(/ /g, "_");
  return `gov-status gov-status--${s}`;
}

export function FeedView({ items, authed }: { items: FeedItem[]; authed: boolean }) {
  const t = useTranslations("feed");
  const tc = useTranslations("categories");
  const ts = useTranslations("status");
  const [tab, setTab] = useState<"list" | "map">("list");
  const [rows, setRows] = useState(items);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    setRows(items);
  }, [items]);

  async function upvote(id: string) {
    if (!authed) {
      toast.error(t("toastLoginUpvote"));
      return;
    }
    if (pending) return;

    const snapshot = rows.find((r) => r.id === id);
    if (!snapshot) return;

    setPending(id);
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

    try {
      const res = await fetch(`/api/v1/reports/${id}/upvote`, { method: "POST" });
      if (!res.ok) throw new Error("upvote_failed");
      const data = (await res.json()) as { upvoted: boolean; count: number };
      setRows((rs) =>
        rs.map((r) =>
          r.id === id
            ? { ...r, viewerUpvoted: Boolean(data.upvoted), upvoteCount: Number(data.count) || 0 }
            : r,
        ),
      );
    } catch {
      toast.error(t("toastUpvoteFail"));
      setRows((rs) => rs.map((r) => (r.id === id ? snapshot : r)));
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      {/* View toggle */}
      <div style={{ marginBottom: "12px", display: "flex", gap: "0" }}>
        <button
          onClick={() => setTab("list")}
          className={tab === "list" ? "gov-btn gov-btn--primary gov-btn--sm" : "gov-btn gov-btn--secondary gov-btn--sm"}
        >
          {t("tableView")}
        </button>
        <button
          onClick={() => setTab("map")}
          className={tab === "map" ? "gov-btn gov-btn--primary gov-btn--sm" : "gov-btn gov-btn--secondary gov-btn--sm"}
        >
          {t("mapView")}
        </button>
      </div>

      {tab === "map" ? (
        <FeedMap items={rows} />
      ) : (
        <table className="gov-table">
          <thead>
            <tr>
              <th>{t("thSno")}</th>
              <th>{t("thCategory")}</th>
              <th>{t("thWardArea")}</th>
              <th>{t("thStatus")}</th>
              <th>{t("thDate")}</th>
              <th style={{ textAlign: "center" }}>{t("thUpvotes")}</th>
              <th>{t("thAction")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td>{i + 1}</td>
                <td>{tc(r.category)}</td>
                <td>
                  {r.municipalityName
                    ? t("wardArea", { ward: r.wardNo ?? "", municipality: r.municipalityName })
                    : t("unmappedArea")}
                </td>
                <td>
                  <span className={statusClass(r.status)}>{ts(r.status)}</span>
                </td>
                <td style={{ whiteSpace: "nowrap" }}>{formatDate(r.createdAt)}</td>
                <td style={{ textAlign: "center" }}>
                  <button
                    onClick={() => upvote(r.id)}
                    disabled={pending === r.id}
                    className={r.viewerUpvoted ? "gov-btn gov-btn--primary gov-btn--sm" : "gov-btn gov-btn--secondary gov-btn--sm"}
                    aria-pressed={r.viewerUpvoted}
                    style={{ padding: "2px 10px", minWidth: "50px" }}
                  >
                    ▲ <span style={{ fontVariantNumeric: "tabular-nums" }}>{r.upvoteCount}</span>
                  </button>
                </td>
                <td>
                  <Link
                    href={`/report/${r.id}`}
                    className="gov-btn gov-btn--secondary gov-btn--sm"
                    style={{ padding: "2px 10px" }}
                  >
                    {t("viewDetails")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function FeedMap({ items }: { items: FeedItem[] }) {
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
