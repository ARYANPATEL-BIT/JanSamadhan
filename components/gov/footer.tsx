import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function GovFooter() {
  const t = await getTranslations("footer");
  const currentDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const visitors = (1248673).toLocaleString("en-IN");

  return (
    <footer className="gov-footer" role="contentinfo">
      <div className="gov-container">
        <div className="gov-footer__columns">
          {/* Column 1: Quick Links */}
          <div>
            <div className="gov-footer__col-title">{t("quickLinks")}</div>
            <ul className="gov-footer__col-list">
              <li><Link href="/">{t("home")}</Link></li>
              <li><Link href="/report/new">{t("registerComplaint")}</Link></li>
              <li><Link href="/feed">{t("publicReports")}</Link></li>
              <li><Link href="/track">{t("trackStatus")}</Link></li>
              <li><Link href="/login">{t("citizenLogin")}</Link></li>
            </ul>
          </div>

          {/* Column 2: Services */}
          <div>
            <div className="gov-footer__col-title">{t("services")}</div>
            <ul className="gov-footer__col-list">
              <li><Link href="/report/new">{t("grievanceRegistration")}</Link></li>
              <li><Link href="/departments">{t("departmentDirectory")}</Link></li>
              <li><Link href="/civic-score">{t("civicScore")}</Link></li>
              <li><Link href="/feed">{t("reportFeed")}</Link></li>
              <li><Link href="/about">{t("rtiInformation")}</Link></li>
            </ul>
          </div>

          {/* Column 3: Policies */}
          <div>
            <div className="gov-footer__col-title">{t("policies")}</div>
            <ul className="gov-footer__col-list">
              <li><Link href="/terms">{t("terms")}</Link></li>
              <li><Link href="/privacy">{t("privacy")}</Link></li>
              <li><Link href="/copyright">{t("copyright")}</Link></li>
              <li><Link href="/hyperlinking">{t("hyperlinking")}</Link></li>
              <li><Link href="/accessibility">{t("accessibility")}</Link></li>
            </ul>
          </div>

          {/* Column 4: Contact */}
          <div>
            <div className="gov-footer__col-title">{t("contactUs")}</div>
            <ul className="gov-footer__col-list">
              <li>{t("corpName")}</li>
              <li>{t("addressLine1")}</li>
              <li>{t("addressLine2")}</li>
              <li>{t("phone")}</li>
              <li>{t("email")}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="gov-footer__bottom">
        <div className="gov-container">
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
            <span>
              {t.rich("managedBy", { strong: (c) => <strong>{c}</strong> })}
              {" · "}
              {t("lastUpdated", { date: currentDate })}
              {" · "}
              {t("visitors", { count: visitors })}
            </span>
            <span>
              {t.rich("designedBy", { strong: (c) => <strong>{c}</strong> })}
            </span>
          </div>
          <div className="gov-footer__policies" style={{ marginTop: "6px" }}>
            {t("compliance")}{" · "}
            <Link href="/terms">{t("terms")}</Link>{" | "}
            <Link href="/privacy">{t("privacy")}</Link>{" | "}
            <Link href="/copyright">{t("copyright")}</Link>{" | "}
            <Link href="/hyperlinking">{t("hyperlinking")}</Link>{" | "}
            <Link href="/accessibility">{t("accessibility")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
