import type { Metadata } from "next";
import Link from "next/link";
import ChartBackground from "@/components/ChartBackground";
import { site } from "@/lib/data";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bite Index — Sydney fishing conditions, scored daily",
  description:
    "A free daily read on Sydney fishing: transparent 0–100 scores for rock, beach, estuary, harbour and offshore, the best species to target today, and how to rig for them.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const sample = site.source === "sample";
  return (
    <html lang="en-AU">
      <body>
        <ChartBackground />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
        />
        {sample && (
          <div className="banner">
            SAMPLE DATA — this build is running on the synthetic demo forecast, not live conditions.
          </div>
        )}
        <nav className="nav" aria-label="Main">
          <div className="nav-inner">
            <div>
              <Link href="/" className="wordmark">
                BITE<span> INDEX</span>
              </Link>{" "}
              <span className="nav-sub">SYDNEY · {site.location.lat.toFixed(2)}, {site.location.lon.toFixed(2)}</span>
            </div>
            <div className="nav-links">
              <Link href="/">Today</Link>
              <Link href="/species">Species</Link>
              <Link href="/knots">Knots</Link>
              <Link href="/methodology">Methodology</Link>
            </div>
          </div>
        </nav>
        {children}
        <footer>
          <div className="wrap">
            <p>
              <strong>Guidance only, never safety advice.</strong> Conditions on the coast change faster than any
              forecast. Check the BOM warnings and the water in front of you before fishing, and stay off rock
              platforms in swell — lifejackets are mandatory on many declared NSW rock platforms.
            </p>
            <p>
              Scores are produced by a transparent weighting model — every number can be unpacked on the{" "}
              <Link href="/methodology">methodology page</Link>. Size and bag limits are set by{" "}
              <a href="https://www.dpi.nsw.gov.au/fishing" rel="noopener">NSW DPI Fisheries</a> — always check the
              current rules before keeping a fish.
            </p>
            <p className="mono">
              Weather data by <a href="https://open-meteo.com/" rel="noopener">Open-Meteo.com</a> · generated{" "}
              {site.generated_at} · source: {site.source}
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
