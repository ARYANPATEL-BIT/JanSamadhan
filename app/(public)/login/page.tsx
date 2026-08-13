"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

const LANGS = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "bn", label: "বাংলা" },
  { code: "mr", label: "मराठी" },
  { code: "ta", label: "தமிழ்" },
  { code: "te", label: "తెలుగు" },
];

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [lang, setLang] = useState("en");
  const [busy, setBusy] = useState(false);

  async function requestCode() {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      setStep("code");
      if (data.devCode) {
        toast.success(`Dev OTP: ${data.devCode}`, { duration: 10000 });
        setCode(data.devCode);
      } else {
        toast.success("OTP sent");
      }
    } catch (e) {
      toast.error(`Could not send OTP (${(e as Error).message})`);
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code, lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      toast.success("Logged in");
      router.refresh();
      router.push("/report/new");
    } catch (e) {
      toast.error(`Verification failed (${(e as Error).message})`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: "480px", margin: "0 auto", padding: "20px 0" }}>
      <div className="gov-card">
        <div className="gov-card__header">
          {step === "phone" ? "Citizen Login — OTP Verification" : "Enter One-Time Password"}
        </div>
        <div className="gov-card__body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {step === "phone" ? (
            <>
              <div className="gov-form-row">
                <label className="gov-form-row__label" htmlFor="phone">
                  Mobile Number
                </label>
                <div className="gov-form-row__field">
                  <Input
                    id="phone"
                    inputMode="numeric"
                    placeholder="Enter 10-digit mobile number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{ borderRadius: 0 }}
                  />
                  <div className="gov-form-row__hint">
                    An OTP will be sent to this mobile number for verification
                  </div>
                </div>
              </div>

              <div className="gov-form-row">
                <label className="gov-form-row__label">
                  Language
                </label>
                <div className="gov-form-row__field">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {LANGS.map((l) => (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => setLang(l.code)}
                        className={l.code === lang ? "gov-btn gov-btn--primary gov-btn--sm" : "gov-btn gov-btn--secondary gov-btn--sm"}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <button
                  className="gov-btn gov-btn--primary"
                  onClick={requestCode}
                  disabled={busy || phone.replace(/\D/g, "").length < 10}
                >
                  {busy ? "Sending…" : "Send OTP"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="gov-form-row">
                <label className="gov-form-row__label" htmlFor="code">
                  OTP Code
                </label>
                <div className="gov-form-row__field">
                  <Input
                    id="code"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Enter 6-digit OTP"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    style={{ borderRadius: 0 }}
                  />
                  <div className="gov-form-row__hint">
                    6-digit code sent to {phone}. In dev mode, the code is logged to the server console.
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => setStep("phone")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--link)",
                    textDecoration: "underline",
                    cursor: "pointer",
                    fontSize: "0.857rem",
                  }}
                >
                  ← Change Number
                </button>
                <button
                  className="gov-btn gov-btn--primary"
                  onClick={verify}
                  disabled={busy || code.length !== 6}
                >
                  {busy ? "Verifying…" : "Verify & Continue"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
