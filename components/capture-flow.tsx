"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
      setCameraError(
        "Camera unavailable or permission denied. Please allow camera access and reload — reporting requires an in-app photo.",
      );
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
        throw new Error("Location permission is required to file a report.");
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

  function shutter() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) {
      toast.error("Camera not ready yet.");
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
      toast.success("Report submitted");
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
          <div className="gov-card__header">Review & Submit Complaint</div>
          <div className="gov-card__body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

            {/* --- AI Analysis Status --- */}
            {ai.status === "failed" && (
              <div className="gov-notice gov-notice--info" style={{ margin: 0 }}>
                Automatic image analysis is temporarily unavailable.
                You can select the issue category manually.
              </div>
            )}

            {/* --- Spam / legitimacy warning --- */}
            {ai.spamSuspected && (
              <div className="gov-notice gov-notice--info" style={{ margin: 0 }}>
                We couldn&apos;t verify that this image clearly shows the reported issue.
                Your report can still be submitted for review.
              </div>
            )}

            {/* --- Confidence-based category display --- */}
            <div>
              <div style={{ fontSize: "0.857rem", color: "var(--text-muted)", marginBottom: "6px" }}>
                {confDecision === "AUTO_ACCEPT" && ai.status === "completed" && (
                  <>
                    <span style={{ color: "var(--gov-green)" }}>✓</span>{" "}
                    Automatically categorized as{" "}
                    <strong style={{ color: "var(--text)" }}>
                      {CATEGORY_META[s.category]?.label ?? s.category}
                    </strong>
                    {s.ward
                      ? ` → Ward ${s.ward.wardNo}, ${s.ward.municipalityName}`
                      : " → outside seeded wards (no auto-routing)"}
                    {" "}({(s.confidence * 100).toFixed(0)}% confidence).
                    Not correct? Select below:
                  </>
                )}
                {confDecision === "SUGGEST" && ai.status === "completed" && (
                  <>
                    We think this may be a{" "}
                    <strong style={{ color: "var(--text)" }}>
                      {CATEGORY_META[s.category]?.label ?? s.category}
                    </strong>
                    {s.ward
                      ? ` → Ward ${s.ward.wardNo}, ${s.ward.municipalityName}`
                      : ""}
                    {" "}({(s.confidence * 100).toFixed(0)}% confidence).
                    Is that correct?
                  </>
                )}
                {(confDecision === "MANUAL" || ai.status !== "completed") && (
                  <>
                    {ai.status === "completed"
                      ? "We couldn't confidently identify the issue."
                      : "Please select the issue category:"}
                    {s.ward
                      ? ` Location: Ward ${s.ward.wardNo}, ${s.ward.municipalityName}.`
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
                    ✓ Yes, that&apos;s correct
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
                    Choose another category
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
                    {CATEGORY_META[c as Category]?.label ?? c}
                  </button>
                ))}
              </div>
            </div>

            {/* Trust & verdict badges */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              <span className={trust >= 0.75 ? "gov-badge gov-badge--success" : "gov-badge gov-badge--danger"}>
                Capture Trust: {(trust * 100).toFixed(0)}%
              </span>
              {ai.status === "completed" && s.confidence > 0 && (
                <span className={
                  s.confidence >= 0.75
                    ? "gov-badge gov-badge--success"
                    : s.confidence >= 0.5
                      ? "gov-badge gov-badge--saffron"
                      : "gov-badge gov-badge--danger"
                }>
                  AI Confidence: {(s.confidence * 100).toFixed(0)}%
                </span>
              )}
              {ai.status === "completed" && ai.engine !== "stub" && (
                <span className="gov-badge gov-badge--success" style={{ fontSize: "0.7rem" }}>
                  AI Verified
                </span>
              )}
              {ai.status === "failed" && (
                <span className="gov-badge gov-badge--danger" style={{ fontSize: "0.7rem" }}>
                  AI Unavailable
                </span>
              )}
              {draft!.verdict.combined === "MANUAL_REVIEW" && (
                <span className="gov-badge gov-badge--saffron">Routed to Manual Review</span>
              )}
              {draft!.verdict.combined === "CLEAN_HIGH_TRUST" && (
                <span className="gov-badge gov-badge--success">Verified · Auto-Routed</span>
              )}
              {draft!.verdict.combined === "DUPLICATE_CANDIDATES" && (
                <span className="gov-badge gov-badge--saffron">Possible Duplicate Detected</span>
              )}
              {ai.spamSuspected && (
                <span className="gov-badge gov-badge--danger">Needs Verification</span>
              )}
            </div>

            {/* Duplicate candidate notice */}
            {draft!.verdict.combined === "DUPLICATE_CANDIDATES" &&
              Array.isArray(draft!.verdict.candidates) &&
              draft!.verdict.candidates.length > 0 && (
              <div className="gov-notice gov-notice--info" style={{ margin: 0 }}>
                <strong>Possible duplicate:</strong>{" "}
                {draft!.verdict.candidates.length} similar report(s) found nearby.
                Your report can still be submitted — it will be reviewed for duplicates.
              </div>
            )}

            {/* Description */}
            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.857rem", marginBottom: "4px" }}>
                Description (optional, max 200 characters)
              </label>
              <Textarea
                placeholder="Add a short description of the issue"
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
                {phase === "submitting" ? "Submitting…" : "Submit Complaint"}
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
                Retake
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
            <div>Analyzing your image…</div>
            <div style={{ fontSize: "0.8rem", opacity: 0.7 }}>
              Verifying image and detecting issue category
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}
      </div>
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {cameraError && (
        <div className="gov-notice gov-notice--danger">{cameraError}</div>
      )}

      <button
        className="gov-btn gov-btn--saffron gov-btn--lg gov-btn--block"
        onClick={shutter}
        disabled={phase === "analyzing" || !!cameraError}
        style={{ fontSize: "1.1rem", minHeight: "52px" }}
      >
        {phase === "analyzing" ? "Analyzing…" : "📸 Capture Photograph"}
      </button>
      <div className="gov-notice gov-notice--info" style={{ margin: 0 }}>
        In-app camera only. This binds your live GPS location and timestamp to
        the photograph at the moment of capture.
      </div>
    </div>
  );
}
