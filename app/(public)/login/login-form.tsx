"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { locales, localeNames } from "@/i18n/config";

export function LoginForm() {
  const t = useTranslations("login");
  const searchParams = useSearchParams();
  const isDept = searchParams.get("portal") === "dept";
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
        toast.success(t("toastDevOtp", { code: data.devCode }), { duration: 10000 });
        setCode(data.devCode);
      } else {
        toast.success(t("toastOtpSent"));
      }
    } catch (e) {
      toast.error(t("toastOtpFail", { message: (e as Error).message }));
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
        body: JSON.stringify({
          phone,
          code,
          lang,
          portal: isDept ? "dept" : "citizen",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error === "not_staff" ? t("notStaff") : (data.error ?? "failed"));
      }
      toast.success(t("toastLoggedIn"));
      if (isDept) {
        const dest = data.staffRole === "FIELD_STAFF" ? "/dept/tasks" : "/dept/queue";
        window.location.assign(dest);
        return;
      }
      const next = searchParams.get("next");
      window.location.assign(next && !next.startsWith("/dept") ? next : "/home");
    } catch (e) {
      toast.error(t("toastVerifyFail", { message: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: "480px", margin: "0 auto", padding: "20px 0" }}>
      <div className="gov-card">
        <div className="gov-card__header">
          {step === "phone"
            ? isDept ? t("titlePhoneDept") : t("titlePhone")
            : isDept ? t("titleCodeDept") : t("titleCode")}
        </div>
        <div className="gov-card__body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {step === "phone" ? (
            <>
              <div className="gov-form-row">
                <label className="gov-form-row__label" htmlFor="phone">
                  {t("mobileNumber")}
                </label>
                <div className="gov-form-row__field">
                  <Input
                    id="phone"
                    inputMode="numeric"
                    placeholder={t("mobilePlaceholder")}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{ borderRadius: 0 }}
                  />
                  <div className="gov-form-row__hint">
                    {isDept ? t("mobileHintDept") : t("mobileHint")}
                  </div>
                </div>
              </div>

              <div className="gov-form-row">
                <label className="gov-form-row__label">
                  {t("language")}
                </label>
                <div className="gov-form-row__field">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {locales.map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setLang(code)}
                        className={code === lang ? "gov-btn gov-btn--primary gov-btn--sm" : "gov-btn gov-btn--secondary gov-btn--sm"}
                      >
                        {localeNames[code]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                <Link
                  href={isDept ? "/login" : "/login?portal=dept"}
                  style={{ fontSize: "0.857rem" }}
                >
                  {isDept ? t("switchToCitizen") : t("switchToDept")}
                </Link>
                <button
                  className="gov-btn gov-btn--primary"
                  onClick={requestCode}
                  disabled={busy || phone.replace(/\D/g, "").length < 10}
                >
                  {busy ? t("sending") : t("sendOtp")}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="gov-form-row">
                <label className="gov-form-row__label" htmlFor="code">
                  {t("otpCode")}
                </label>
                <div className="gov-form-row__field">
                  <Input
                    id="code"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder={t("otpPlaceholder")}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    style={{ borderRadius: 0 }}
                  />
                  <div className="gov-form-row__hint">
                    {t("otpHint", { phone })}
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
                  ← {t("changeNumber")}
                </button>
                <button
                  className="gov-btn gov-btn--primary"
                  onClick={verify}
                  disabled={busy || code.length !== 6}
                >
                  {busy ? t("verifying") : t("verifyContinue")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
