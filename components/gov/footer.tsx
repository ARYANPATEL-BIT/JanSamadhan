import Link from "next/link";

export function GovFooter() {
  const currentDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <footer className="gov-footer" role="contentinfo">
      <div className="gov-container">
        <div className="gov-footer__columns">
          {/* Column 1: Quick Links */}
          <div>
            <div className="gov-footer__col-title">Quick Links</div>
            <ul className="gov-footer__col-list">
              <li><Link href="/">Home</Link></li>
              <li><Link href="/report/new">Register Complaint</Link></li>
              <li><Link href="/feed">Public Reports</Link></li>
              <li><Link href="/track">Track Status</Link></li>
              <li><Link href="/login">Citizen Login</Link></li>
            </ul>
          </div>

          {/* Column 2: Services */}
          <div>
            <div className="gov-footer__col-title">Services</div>
            <ul className="gov-footer__col-list">
              <li><Link href="/report/new">Grievance Registration</Link></li>
              <li><Link href="/departments">Department Directory</Link></li>
              <li><Link href="/civic-score">Civic Score</Link></li>
              <li><Link href="/feed">Report Feed</Link></li>
              <li><Link href="/about">RTI Information</Link></li>
            </ul>
          </div>

          {/* Column 3: Policies */}
          <div>
            <div className="gov-footer__col-title">Policies</div>
            <ul className="gov-footer__col-list">
              <li><Link href="/terms">Terms &amp; Conditions</Link></li>
              <li><Link href="/privacy">Privacy Policy</Link></li>
              <li><Link href="/copyright">Copyright Policy</Link></li>
              <li><Link href="/hyperlinking">Hyperlinking Policy</Link></li>
              <li><Link href="/accessibility">Accessibility Statement</Link></li>
            </ul>
          </div>

          {/* Column 4: Contact */}
          <div>
            <div className="gov-footer__col-title">Contact Us</div>
            <ul className="gov-footer__col-list">
              <li>Nagarpratinidhi Municipal Corporation</li>
              <li>Municipal Bhavan, Civil Lines</li>
              <li>Nagarpratinidhi — 834001</li>
              <li>Phone: 0651-XXXXXXX</li>
              <li>Email: grievance@nmc.gov.in</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="gov-footer__bottom">
        <div className="gov-container">
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
            <span>
              Website Content Managed by <strong>Nagarpratinidhi Municipal Corporation</strong> ·
              Last Updated on: {currentDate} ·
              Visitors: <span style={{ fontVariantNumeric: "tabular-nums" }}>12,48,673</span>
            </span>
            <span>
              Designed, Developed and Hosted by <strong>NMC IT Division</strong>
            </span>
          </div>
          <div className="gov-footer__policies" style={{ marginTop: "6px" }}>
            WCAG 2.1 Compliant · W3C Valid HTML ·{" "}
            <Link href="/terms">Terms &amp; Conditions</Link>{" | "}
            <Link href="/privacy">Privacy Policy</Link>{" | "}
            <Link href="/copyright">Copyright Policy</Link>{" | "}
            <Link href="/hyperlinking">Hyperlinking Policy</Link>{" | "}
            <Link href="/accessibility">Accessibility Statement</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
