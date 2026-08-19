import latestJson from "@/data/latest.json";
import profilesJson from "@/data/profiles.json";
import type { Day, Profiles, SiteData } from "./types";

export const site = latestJson as unknown as SiteData;
export const profiles = profilesJson as unknown as Profiles;

export type Tier = "excellent" | "good" | "fair" | "poor";

/* Reads the live thresholds from factors.json's score_labels rather than a
   second hardcoded copy -- that mismatch already happened once (this
   function stayed at 80/60/40 when score_labels moved to 62/48/32 for the
   calibrated scale, so a card's colour and its text label could disagree
   for a while). One source of truth now. */
export function tier(score: number): Tier {
  const labels = profiles.factors.score_labels;
  const sorted = [...labels].sort((a, b) => b.min - a.min);
  const hit = sorted.find((l) => score >= l.min) ?? sorted[sorted.length - 1];
  return hit.label.toLowerCase() as Tier;
}

export function tierLabel(score: number): string {
  const t = tier(score);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d
    .toLocaleDateString("en-AU", { weekday: "short", day: "2-digit", month: "short" })
    .toUpperCase();
}

export function shortEnv(name: string): string {
  if (name.toLowerCase().startsWith("boat")) return "Offshore";
  return name.split(" & ")[0];
}

export function dayNum(iso: string): string {
  return String(new Date(iso + "T00:00:00").getDate());
}

/* Middle of the 5 grounds' raw scores for one day -- "is today worth going
   at all", as opposed to "where should I fish" (which the ledger/best-ground
   pick answers). Deliberately the median, not the mean: a real ground's
   actual score, not an average nobody's ground produced. Not tier-coloured
   anywhere it's shown -- it's a raw composite across profiles with different
   curve-defined ceilings, never rescaled against any one profile's own
   history, so it has no defined position on the calibrated scale.

   2026-08-19: briefly excluded boat from this median, reverted the same
   day alongside the BEST TODAY ranking -- see build_headline()'s docstring
   in scoring.py for why. */
export function overallDay(day: Day): number | null {
  const scores = [...day.environments].map((e) => e.score).sort((a, b) => a - b);
  return scores.length ? scores[Math.floor((scores.length - 1) / 2)] : null;
}
