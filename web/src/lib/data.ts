import latestJson from "@/data/latest.json";
import profilesJson from "@/data/profiles.json";
import type { Profiles, SiteData } from "./types";

export const site = latestJson as unknown as SiteData;
export const profiles = profilesJson as unknown as Profiles;

export type Tier = "excellent" | "good" | "fair" | "poor";

export function tier(score: number): Tier {
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "fair";
  return "poor";
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
