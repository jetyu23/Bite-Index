import Link from "next/link";
import CondLog from "@/components/CondLog";
import EnvRow from "@/components/EnvRow";
import TideInstrument from "@/components/TideInstrument";
import { fmtDate, site, tier } from "@/lib/data";

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
          <div className="stamp">CALIBRATED<br />MEDIAN DAY = 50</div>
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
            all five grounds surveyed daily · same conditions, five answers (<Link href="/methodology">why</Link>) ·
            tick on every meter marks the median day (50) · open a row for the factor breakdown
          </p>
          {(() => {
            const bestId = today.environments.reduce((a, b) => (b.score > a.score ? b : a)).id;
            return today.environments.map((e) => <EnvRow env={e} best={e.id === bestId} key={e.id} />);
          })()}
        </section>

        <section aria-labelledby="sp-h">
          <h2 className="sec" id="sp-h"><span className="tick" style={{ background: "var(--ochre)" }} />WHAT TO CHASE: CONTACT LIST</h2>
          <p className="sechint">
            each species scored on its own profile, then ranked · full list shown, nothing hidden ·{" "}
            <Link href="/species">rigging guide for every contact</Link> · more species to be added: a new fish is
            one config file, no code
          </p>
          {today.species.map((sp, i) => {
            const t = tier(sp.score);
            return (
              <div className={`row tb-${t[0]}`} key={sp.id}>
                {i === 0 && <div className="rstamp ochre">PRIME CONTACT</div>}
                <div>
                  <span className="rk">{String(i + 1).padStart(2, "0")}</span>
                  <span className="nm"><Link href={`/species#${sp.id}`}>{sp.name}</Link></span>
                  <span className={`tag c-${sp.environment}`}>{sp.tag || sp.environment_name.toUpperCase()}</span>
                  <span className="win">{sp.best_window}</span>
                  <span className="why">{sp.reason}</span>
                </div>
                <div className={`sc ${t[0]}`}>
                  <b>{sp.score}</b>
                  <i>{sp.label.toUpperCase()}</i>
                </div>
                <div className={`meter ${t[0]}`}>
                  <i style={{ width: `${sp.score}%` }} />
                  <u title="calibrated median day (50)" />
                </div>
              </div>
            );
          })}
        </section>

        <section aria-labelledby="ol-h">
          <h2 className="sec" id="ol-h"><span className="tick" style={{ background: "var(--blue)" }} />THE WEEK AHEAD</h2>
          <p className="sechint">best ground per day, from the same engine</p>
          <div className="outlook">
            {site.days.map((d) => {
              const best = d.environments.reduce((a, b) => (b.score > a.score ? b : a));
              const rockFlag = d.environments.some((e) => e.safety_flag);
              return (
                <div className="o-day" key={d.date}>
                  <div className="o-wd">{d.weekday.toUpperCase()}</div>
                  <div className={`o-score ${tier(best.score)[0]}`}>{best.score}</div>
                  <div className="o-env">{best.name.split(" & ")[0].toUpperCase()}</div>
                  {rockFlag && <div className="o-flag">ROCKS ✕</div>}
                </div>
              );
            })}
          </div>
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
