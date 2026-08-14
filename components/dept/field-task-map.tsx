import dynamic from "next/dynamic";

export const FieldTaskMap = dynamic(
  () => import("./field-task-map-inner").then((m) => m.FieldTaskMap),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          height: "240px",
          width: "100%",
          border: "1px solid var(--gov-border)",
          background: "var(--surface-muted, #f3f3f3)",
        }}
      />
    ),
  },
);
