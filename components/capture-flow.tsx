"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORY_META } from "@/lib/categories";

type Category = keyof typeof CATEGORY_META;

interface DraftResponse {
  ticket: string;
  verdict: {
    combined: string;
    captureTrust: number;
    nsfw: boolean;
    candidates: unknown[];
  };
  suggestion: {
    category: Category;
    confidence: number;
    confidenceDecision: "AUTO_ACCEPT" | "SUGGEST" | "MANUAL";
    ward: { wardNo: number; municipalityName: string } | null;
    hasDepartment: boolean;
    imageUrl: string;
  };
  ai: {
    status: "completed" | "failed" | "skipped";
    spamSuspected: boolean;
    isCivicIssue: boolean;
    engine: string;
  };
}

type Phase = "capture" | "analyzing" | "draft" | "submitting";

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  });
}

export function CaptureFlow({ categories }: { categories: readonly string[] }) {
  const t = useTranslations("capture");
  const tc = useTranslations("categories");
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [phase, setPhase] = useState<Phase>("capture");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftResponse | null>(null);
  const [chosenCategory, setChosenCategory] = useState<Category>("pothole");
  const [description, setDescription] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setCameraError(t("cameraError"));
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  /** Convert a blob + capture facts into a draft via the pipeline. */
  async function submitDraft(blob: Blob, capturePath: "IN_APP" | "GALLERY") {
    setPhase("analyzing");
    try {
      // Bind device geolocation + client timestamp at the moment of capture.
      const pos = await getPosition().catch(() => {
        throw new Error(t("toastLocationRequired"));
      });
      const capturedAt = Date.now();

      const form = new FormData();
      form.set("image", blob, "capture.jpg");
      form.set("lng", String(pos.coords.longitude));
      form.set("lat", String(pos.coords.latitude));
      form.set("accuracy", String(pos.coords.accuracy ?? ""));
      form.set("capturedAt", String(capturedAt));
      form.set("capturePath", capturePath);

      const res = await fetch("/api/v1/reports/draft", { method: "POST", body: form });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await res.json()) as DraftResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "draft_failed");

      stopCamera();
      setDraft(data);
      setChosenCategory(data.suggestion.category);
      setPreviewUrl(data.suggestion.imageUrl);
      setPhase("draft");
    } catch (e) {
      toast.error((e as Error).message);
      setPhase("capture");
    }
  }

  /** Gallery fallback — lower-trust, always routed to manual review. */
  function onGalleryPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) submitDraft(file, "GALLERY");
    // reset so picking the same file again re-fires onChange
    e.target.value = "";
  }

  function shutter() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) {
      toast.error(t("cameraNotReady"));
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) submitDraft(blob, "IN_APP");
      },
      "image/jpeg",
      0.9,
    );
  }

  async function submitReport() {
    if (!draft) return;
    setPhase("submitting");
    try {
      const res = await fetch("/api/v1/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket: draft.ticket,
          category: chosenCategory,
          description: description || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "submit_failed");
      toast.success(t("toastSubmitted"));
      router.push(`/report/${data.id}`);
    } catch (e) {
      toast.error((e as Error).message);
      setPhase("draft");
    }
  }

  // ---- Draft screen (kiosk-mode: large touch targets, institutional) ------
  if (phase === "draft" || phase === "submitting") {
    const s = draft!.suggestion;
    const ai = draft!.ai;
    const trust = draft!.verdict.captureTrust;
    const confDecision = s.confidenceDecision;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {previewUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={previewUrl}
            alt="captured issue"
            style={{
              width: "100%",
              border: "1px solid var(--gov-border)",
              objectFit: "cover",
            }}
          />
        )}

        <div className="gov-card">
          <div className="gov-card__header">{t("reviewTitle")}</div>
          <div className="gov-card__body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

            {/* --- AI Analysis Status --- */}
            {ai.status === "failed" && (
              <div className="gov-notice gov-notice--info" style={{ margin: 0 }}>
                {t("aiUnavailableNotice")}
              </div>
            )}

            {/* --- Spam / legitimacy warning --- */}
            {ai.spamSuspected && (
              <div className="gov-notice gov-notice--info" style={{ margin: 0 }}>
                {t("aiSpamNotice")}
              </div>
            )}

            {/* --- Confidence-based category display --- */}
            <div>
              <div style={{ fontSize: "0.857rem", color: "var(--text-muted)", marginBottom: "6px" }}>
                {confDecision === "AUTO_ACCEPT" && ai.status === "completed" && (
                  <>
                    <span style={{ color: "var(--gov-green)" }}>✓</span>{" "}
                    {t("aiAutoCategorized")}{" "}
                    <strong style={{ color: "var(--text)" }}>
                      {tc(s.category)}
                    </strong>
                    {s.ward
                      ? t("wardRoute", { ward: s.ward.wardNo, municipality: s.ward.municipalityName })
                      : t("outsideWards")}
                    {" "}{t("aiConfidenceSuffix", { pct: (s.confidence * 100).toFixed(0) })}{" "}
                    {t("aiNotCorrect")}
                  </>
                )}
                {confDecision === "SUGGEST" && ai.status === "completed" && (
                  <>
                    {t("aiSuggest")}{" "}
                    <strong style={{ color: "var(--text)" }}>
                      {tc(s.category)}
                    </strong>
                    {s.ward
                      ? t("wardRoute", { ward: s.ward.wardNo, municipality: s.ward.municipalityName })
                      : ""}
                    {" "}{t("aiConfidenceSuffix", { pct: (s.confidence * 100).toFixed(0) })}{" "}
                    {t("aiIsThatCorrect")}
                  </>
                )}
                {(confDecision === "MANUAL" || ai.status !== "completed") && (
                  <>
                    {ai.status === "completed"
                      ? t("aiCantIdentify")
                      : t("aiSelectCategory")}
                    {s.ward
                      ? ` ${t("aiLocation", { ward: s.ward.wardNo, municipality: s.ward.municipalityName })}`
                      : ""}
                  </>
                )}
              </div>

              {/* Quick confirm/reject for SUGGEST mode */}
              {confDecision === "SUGGEST" && ai.status === "completed" && (
                <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setChosenCategory(s.category)}
                    className={
                      chosenCategory === s.category
                        ? "gov-btn gov-btn--primary gov-btn--sm"
                        : "gov-btn gov-btn--secondary gov-btn--sm"
                    }
                    style={{ minHeight: "36px" }}
                  >
                    ✓ {t("aiYesCorrect")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Show all categories by ensuring current doesn't match suggestion
                      if (chosenCategory === s.category) {
                        setChosenCategory("other" as Category);
                      }
                    }}
                    className="gov-btn gov-btn--secondary gov-btn--sm"
                    style={{ minHeight: "36px" }}
                  >
                    {t("aiChooseAnother")}
                  </button>
                </div>
              )}

              {/* Category picker — always shown for MANUAL, shown when user wants to change for others */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setChosenCategory(c as Category)}
                    className={
                      chosenCategory === c
                        ? "gov-btn gov-btn--primary gov-btn--sm"
                        : "gov-btn gov-btn--secondary gov-btn--sm"
                    }
                    style={{ minHeight: "36px" }}
                  >
                    {tc(c)}
                  </button>
                ))}
              </div>
            </div>

            {/* Trust & verdict badges */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              <span className={trust >= 0.75 ? "gov-badge gov-badge--success" : "gov-badge gov-badge--danger"}>
                {t("captureTrust", { pct: (trust * 100).toFixed(0) })}
              </span>
              {ai.status === "completed" && s.confidence > 0 && (
                <span className={
                  s.confidence >= 0.75
                    ? "gov-badge gov-badge--success"
                    : s.confidence >= 0.5
                      ? "gov-badge gov-badge--saffron"
                      : "gov-badge gov-badge--danger"
                }>
                  {t("aiConfidence", { pct: (s.confidence * 100).toFixed(0) })}
                </span>
              )}
              {ai.status === "completed" && ai.engine !== "stub" && (
                <span className="gov-badge gov-badge--success" style={{ fontSize: "0.7rem" }}>
                  {t("aiVerified")}
                </span>
              )}
              {ai.status === "failed" && (
                <span className="gov-badge gov-badge--danger" style={{ fontSize: "0.7rem" }}>
                  {t("aiUnavailable")}
                </span>
              )}
              {draft!.verdict.combined === "MANUAL_REVIEW" && (
                <span className="gov-badge gov-badge--saffron">{t("routedManual")}</span>
              )}
              {draft!.verdict.combined === "CLEAN_HIGH_TRUST" && (
                <span className="gov-badge gov-badge--success">{t("verifiedAutoRouted")}</span>
              )}
              {draft!.verdict.combined === "DUPLICATE_CANDIDATES" && (
                <span className="gov-badge gov-badge--saffron">{t("aiPossibleDuplicate")}</span>
              )}
              {ai.spamSuspected && (
                <span className="gov-badge gov-badge--danger">{t("aiNeedsVerification")}</span>
              )}
            </div>

            {/* Duplicate candidate notice */}
            {draft!.verdict.combined === "DUPLICATE_CANDIDATES" &&
              Array.isArray(draft!.verdict.candidates) &&
              draft!.verdict.candidates.length > 0 && (
              <div className="gov-notice gov-notice--info" style={{ margin: 0 }}>
                <strong>{t("aiDuplicateLabel")}</strong>{" "}
                {t("aiDuplicateText", { count: draft!.verdict.candidates.length })}
              </div>
            )}

            {/* Description */}
            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.857rem", marginBottom: "4px" }}>
                {t("descriptionLabel")}
              </label>
              <Textarea
                placeholder={t("descriptionPlaceholder")}
                maxLength={200}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ borderRadius: 0, border: "1px solid var(--gov-border)" }}
              />
            </div>

            {/* Actions — large touch targets for kiosk mode */}
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="gov-btn gov-btn--primary gov-btn--lg"
                style={{ flex: 1 }}
                onClick={submitReport}
                disabled={phase === "submitting"}
              >
                {phase === "submitting" ? t("submitting") : t("submitComplaint")}
              </button>
              <button
                className="gov-btn gov-btn--secondary gov-btn--lg"
                onClick={() => {
                  setDraft(null);
                  setPhase("capture");
                  startCamera();
                }}
                disabled={phase === "submitting"}
              >
                {t("retake")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Capture screen (kiosk-mode: full-bleed camera, large shutter) ------
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ position: "relative", overflow: "hidden", border: "1px solid var(--gov-border)", background: "#000" }}>
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ aspectRatio: "3/4", width: "100%", objectFit: "cover", display: "block" }}
        />
        {phase === "analyzing" && (
          <div style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            fontSize: "1rem",
            gap: "12px",
          }}>
            <div style={{
              width: "40px",
              height: "40px",
              border: "3px solid rgba(255,255,255,0.3)",
              borderTop: "3px solid #fff",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }} />
            <div>{t("analyzing")}</div>
            <div style={{ fontSize: "0.8rem", opacity: 0.7 }}>
              {t("analyzingSub")}
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}
      </div>
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {cameraError && (
        <div className="gov-notice gov-notice--danger">{cameraError}</div>
      )}

      <div style={{ display: "flex", gap: "8px" }}>
        <button
          className="gov-btn gov-btn--saffron gov-btn--lg"
          onClick={shutter}
          disabled={phase === "analyzing" || !!cameraError}
          style={{ flex: 1, fontSize: "1.1rem", minHeight: "52px" }}
        >
          {phase === "analyzing" ? t("analyzingShort") : `📸 ${t("capturePhoto")}`}
        </button>
        <label
          className="gov-btn gov-btn--secondary gov-btn--lg"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "52px",
            cursor: phase === "analyzing" ? "not-allowed" : "pointer",
          }}
        >
          🖼️ {t("galleryUpload")}
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={onGalleryPick}
            disabled={phase === "analyzing"}
          />
        </label>
      </div>
      <div className="gov-notice gov-notice--info" style={{ margin: 0 }}>
        {t("captureNotice")}
      </div>
      <div className="gov-notice gov-notice--info" style={{ margin: 0 }}>
        {t("galleryNotice")}
      </div>
    </div>
  );
}
