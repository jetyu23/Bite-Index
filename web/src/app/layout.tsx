import type { Metadata } from "next";
import Link from "next/link";
import FishBackground from "@/components/FishBackground";
import { site } from "@/lib/data";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bite Index · Daily field survey of Sydney fishing conditions",
  description:
    "A free daily survey of Sydney fishing: transparent 0-100 scores for rock, beach, estuary, harbour and offshore, the best species to target today, and how to rig for them. Every weight in the model is published.",
  openGraph: {
    title: "Bite Index · Sydney fishing conditions, scored daily",
    description: "Transparent scores for five fishing grounds and seven species. Median day = 50. Every weight published.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const sample = site.source === "sample";
  const cal = site.calibration;
  return (
    <html lang="en-AU">
      <body>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=Courier+Prime:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
        />
        <FishBackground />
        {sample && (
          <div style={{ background: "var(--ink)", color: "var(--paper)", fontFamily: "var(--mono)", fontSize: "0.72rem", padding: "8px 20px", textAlign: "center", position: "relative", zIndex: 2 }}>
            SAMPLE DATA: this build is running on the synthetic demo forecast, not live conditions.
          </div>
        )}
        <nav className="nav" aria-label="Main">
          <div className="nav-inner">
            <div>
              <Link href="/" className="wordmark">BITE<span> INDEX</span></Link>{" "}
              <span className="nav-sub">DAILY FIELD SURVEY · SYDNEY {site.location.lat.toFixed(2)}, {site.location.lon.toFixed(2)}</span>
            </div>
            <div className="nav-links">
              <Link href="/">TODAY</Link>
              <Link href="/species">SPECIES</Link>
              <Link href="/knots">KNOTS</Link>
              <Link href="/glossary">GLOSSARY</Link>
              <Link href="/methodology">METHODOLOGY</Link>
            </div>
          </div>
        </nav>
        {children}
        <footer>
          <div className="wrap">
            <p>
              <strong>Guidance only, never safety advice.</strong> Conditions on the coast change faster than any
              forecast. Check the BOM warnings and the water in front of you, and stay off rock platforms in
              swell; lifejackets are mandatory on many declared NSW rock platforms.
            </p>
            <p>
              Every score can be unpacked on the <Link href="/methodology">methodology page</Link>, and every term
              on this paper is defined in the <Link href="/glossary">glossary</Link>. Size and bag limits are set
              by <a href="https://www.dpi.nsw.gov.au/fishing" rel="noopener">NSW DPI Fisheries</a>; always check
              the current rules before keeping a fish.
            </p>
            <p className="mono">
              WEATHER BY <a href="https://open-meteo.com/" rel="noopener">OPEN-METEO</a> · GENERATED {site.generated_at} · SOURCE: {site.source.toUpperCase()} ·{" "}
              {cal?.applied
                ? `CALIBRATED AGAINST ${cal.n_days} DAYS (MEDIAN DAY = 50)`
                : "CALIBRATION PENDING: RECENTRED RAW SCORES IN USE"}{" "}
              · SURVEY ENDS
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
