import { useTranslations } from "next-intl";
import type { StageEntry } from "@/lib/services/tracking";

const STAGE_LABELS: Record<string, string> = {
  SUBMITTED: "stageSubmitted",
  UNDER_REVIEW: "stageUnderReview",
  ASSIGNED: "stageAssigned",
  IN_PROGRESS: "stageInProgress",
  PENDING_VERIFICATION: "stageAwaitingConfirmation",
  RESOLVED: "stageResolved",
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

interface StagStepperProps {
  stages: StageEntry[];
  isRejected: boolean;
  rejectionReason?: string | null;
}

export function StageStepper({ stages, isRejected, rejectionReason }: StagStepperProps) {
  const t = useTranslations("track");

  return (
    <div className="stage-stepper" role="list" aria-label={t("progressLabel")}>
      {stages.map((entry) => {
        if (entry.state === "skipped") return null;

        const stateClass =
          isRejected && entry.state === "current"
            ? "stage-stepper__step--rejected"
            : `stage-stepper__step--${entry.state}`;

        const indicator =
          entry.state === "completed"
            ? "✓"
            : entry.state === "current"
              ? isRejected
                ? "✗"
                : "●"
              : "○";

        return (
          <div
            key={entry.stage}
            className={`stage-stepper__step ${stateClass}`}
            role="listitem"
            aria-current={entry.state === "current" ? "step" : undefined}
          >
            <div className="stage-stepper__indicator" aria-hidden="true">
              {indicator}
            </div>
            <div>
              <span className="stage-stepper__label">
                {t(STAGE_LABELS[entry.stage] ?? entry.stage)}
              </span>
              {entry.enteredAt && (
                <span className="stage-stepper__date">
                  {formatDate(entry.enteredAt)}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {isRejected && rejectionReason && (
        <div className="stage-stepper__step stage-stepper__step--rejected" role="listitem">
          <div className="stage-stepper__indicator" aria-hidden="true">✗</div>
          <div>
            <span className="stage-stepper__label">{t("stageRejected")}</span>
            <span className="stage-stepper__date">{rejectionReason}</span>
          </div>
        </div>
      )}
    </div>
  );
}
