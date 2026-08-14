import { useTranslations } from "next-intl";
import type { TimelineEvent } from "@/lib/services/tracking";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "eventSubmitted",
  ASSIGNED: "eventAssigned",
  IN_PROGRESS: "eventInProgress",
  PENDING_CITIZEN_VERIFICATION: "eventPendingVerification",
  RESOLVED: "eventResolved",
  REOPENED: "eventReopened",
  REJECTED: "eventRejected",
};

interface EventTimelineProps {
  events: TimelineEvent[];
}

export function EventTimeline({ events }: EventTimelineProps) {
  const t = useTranslations("track");

  if (events.length === 0) return null;

  return (
    <div className="gov-card" style={{ marginBottom: "16px" }}>
      <div className="gov-card__header">{t("timelineTitle")}</div>
      <div className="gov-card__body" style={{ padding: "16px" }}>
        <div className="event-timeline">
          {events.map((event) => {
            const itemClass = event.isReopen
              ? "event-timeline__item event-timeline__item--reopen"
              : event.toStatus === "RESOLVED"
                ? "event-timeline__item event-timeline__item--resolved"
                : event.toStatus === "REJECTED"
                  ? "event-timeline__item event-timeline__item--rejected"
                  : "event-timeline__item";

            return (
              <div key={event.id} className={itemClass}>
                <div className="event-timeline__date">
                  {formatDateTime(event.at)}
                </div>
                <div className="event-timeline__status">
                  {t(STATUS_LABELS[event.toStatus] ?? "eventSubmitted")}
                </div>
                {event.note && (
                  <div className="event-timeline__note">
                    {event.note}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
