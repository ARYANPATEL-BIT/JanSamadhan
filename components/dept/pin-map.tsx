import dynamic from "next/dynamic";

export const PinMap = dynamic(
  () => import("./pin-map-inner").then((m) => m.PinMap),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          height: "220px",
          width: "100%",
          border: "1px solid var(--gov-border)",
          background: "var(--surface-muted, #f3f3f3)",
        }}
      />
    ),
  },
);
