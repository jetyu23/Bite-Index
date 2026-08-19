import Link from "next/link";
import CondLog from "@/components/CondLog";
import ContactList from "@/components/ContactList";
import EnvRow from "@/components/EnvRow";
import TideInstrument from "@/components/TideInstrument";
import WeekAhead from "@/components/WeekAhead";
import { fmtDate, site } from "@/lib/data";

export default function Home() {
  const today = site.days[0];
  if (!today) return <main className="wrap"><p>No data yet; run the engine.</p></main>;

  const s = today.summary;
  const anyFlag = today.environments.some((e) => e.safety_flag);
  const surveyNo = Math.floor(
    (new Date(today.date + "T00:00:00").getTime() - new Date("2026-01-01T00:00:00").getTime()) / 86400000
  ) + 1;

  return (
    <main>
      {anyFlag && (
        <div style={{ background: "var(--red)", color: "var(--paper-hi)", fontFamily: "var(--mono)", fontSize: "0.72rem", padding: "8px 20px", textAlign: "center", position: "relative", zIndex: 2 }}>
          ⚠ ROCK PLATFORMS FLAGGED TODAY. SWELL IS OVER THE SAFETY LINE; THE SCORE IS CAPPED, NOT NEGOTIATED.
        </div>
      )}

      <div className="wrap">
        <div className="classbar">
          <span>FOR ALL HANDS</span>
          <span>SYDNEY STATION · SURVEY No. {surveyNo}</span>
          <span>{fmtDate(today.date)}</span>
        </div>

        <header className="mast">
          <div className="stamp">RAW CONDITIONS<br />SCORE, 0–100</div>
          <div className="stamp blue">FORECAST:<br />TRUST BUT VERIFY</div>
          <h1>BITE <span>INDEX</span></h1>
          <div className="sub">DAILY FIELD SURVEY OF FISHING CONDITIONS · SCORED 0–100 · FULL WEIGHTS PUBLISHED</div>
        </header>

        <section className="hero" style={{ margin: "0 0 10px" }}>
          <p className="lede">{today.headline}</p>
        </section>

        <CondLog s={s} />

        <TideInstrument curve={today.tide_curve} events={s.tide_events} sunrise={s.sunrise} sunset={s.sunset} />

        <section aria-labelledby="env-h">
          <h2 className="sec" id="env-h"><span className="tick" style={{ background: "var(--olive)" }} />THE LEDGER: WHERE TO FISH</h2>
          <p className="sechint">
            four shore grounds surveyed daily, best one called out (<Link href="/methodology#boat">why only four</Link>) ·
            each score is raw conditions, 0–100; the line under it is a calibrated version rescaled to show how rare
            that score is for THIS ground specifically, ordinary is roughly 40 to 70 · tick on every meter marks this
            ground's own typical (median) day · open a row for the factor breakdown
          </p>
          {(() => {
            const shore = today.environments.filter((e) => e.id !== "boat");
            const boat = today.environments.find((e) => e.id === "boat");
            const bestId = shore.reduce((a, b) =>
              (b.rank_score ?? b.score) > (a.rank_score ?? a.score) ? b : a
            ).id;
            const ordered = [...shore].sort((a, b) => {
              if (a.id === bestId) return -1;
              if (b.id === bestId) return 1;
              return 0;
            });
            return (
              <>
                {ordered.map((e) => <EnvRow env={e} best={e.id === bestId} key={e.id} />)}
                {boat && (
                  <div className="ledger-sep">
                    <span className="ledger-sep-label">OFFSHORE &middot; SCORED ON ITS OWN SCALE</span>
                    <p className="sechint">
                      needs a boat, not an alternative to the four grounds above; a different decision, not a fifth
                      contender, so it&apos;s never ranked against them (<Link href="/methodology#boat">why</Link>)
                    </p>
                  </div>
                )}
                {boat && <EnvRow env={boat} best={false} key={boat.id} />}
              </>
            );
          })()}
        </section>

        <section aria-labelledby="sp-h">
          <h2 className="sec" id="sp-h"><span className="tick" style={{ background: "var(--ochre)" }} />WHAT TO CHASE: CONTACT LIST</h2>
          <p className="sechint">
            each species scored on its own profile, then ranked · full list shown, nothing hidden ·{" "}
            <Link href="/species">rigging guide for every contact</Link>
          </p>
          <ContactList species={today.species} />
        </section>

        <section aria-labelledby="ol-h">
          <h2 className="sec" id="ol-h"><span className="tick" style={{ background: "var(--blue)" }} />THE WEEK AHEAD</h2>
          <p className="sechint">each day shows all five grounds as raw-score bars (rock · beach · estuary · harbour, then offshore set apart and hollow, not ranked with the other four (<Link href="/methodology#boat">why</Link>)) so you can read its shape at a glance; the big number is &ldquo;overall day&rdquo;, the middle of the four shore grounds, and answers &ldquo;is today worth going at all&rdquo;; &ldquo;best:&rdquo; underneath names the best shore ground and its own raw score, and answers &ldquo;where should I fish&rdquo;. dashed line = 50, for scale.</p>
          <WeekAhead days={site.days} />
        </section>

        <section aria-labelledby="fl-h">
          <h2 className="sec" id="fl-h"><span className="tick" style={{ background: "var(--red)" }} />FIELD LOG</h2>
          <p className="sechint">
            planned for v3: sessions logged against published scores become the validation dataset. weights never
            move on their own; the log justifies manual, documented changes.
          </p>
          <div className="fieldlog">
            <h3>LOG TODAY&apos;S SESSION (PREVIEW)</h3>
            <div className="flrow">
              <span className="box"><b>GROUND</b>your call</span>
              <span className="box"><b>RESULT</b>what you caught</span>
              <span className="box"><b>VS THE SCORE</b>about right / off</span>
              <span className="box"><b>EXPERIENCE</b>novice / regular / old salt</span>
              <span className="badge pend">STREAK<br />0</span>
              <span className="badge pend">FIRST<br />JEWIE</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
