import type { Metadata } from "next";
import SpeciesExplorer from "@/components/SpeciesExplorer";
import { profiles, site } from "@/lib/data";

export const metadata: Metadata = { title: "Species guide · Bite Index" };

export default function SpeciesPage() {
  const today = site.days[0];
  const todayScores = Object.fromEntries((today?.species ?? []).map((s) => [s.id, s]));
  const currentMonth = today ? new Date(today.date + "T00:00:00").getMonth() + 1 : new Date().getMonth() + 1;

  return (
    <main className="wrap">
      <div className="classbar">
        <span>CONTACT DOSSIERS</span>
        <span>GENERAL HABITAT ONLY · NO SECRET SPOTS</span>
        <span>KEEP WITH LOG</span>
      </div>
      <header className="hero" style={{ position: "relative" }}>
        <div className="stamp blue" style={{ right: 0 }}>CHECK DPI<br />LIMITS FIRST</div>
        <h1 className="headline">Twelve Sydney staples, from the gateway fish up.</h1>
        <p className="sechint" style={{ marginTop: 10 }}>
          the short version on every card; open FULL SPEC if you want the gear numbers. sizes and bag limits are{" "}
          <a href="https://www.dpi.nsw.gov.au/fishing" rel="noopener">NSW DPI&apos;s</a> department, not ours. more
          species to be added: a new fish is one config file.
        </p>
      </header>

      <SpeciesExplorer species={profiles.species} todayScores={todayScores} currentMonth={currentMonth} />
    </main>
  );
}
