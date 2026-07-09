import Link from "next/link";
import ScoreCard from "@/components/ScoreCard";
import TideCurve from "@/components/TideCurve";
import { fmtDate, site, tier } from "@/lib/data";

export default function Home() {
  const today = site.days[0];
  if (!today) return <main className="wrap"><p>No data yet — run the engine.</p></main>;

  const s = today.summary;
  const anyFlag = today.environments.some((e) => e.safety_flag);

  const chips: (string | null)[] = [
    s.tide_events.length
      ? "tides " + s.tide_events.map((e) => `${e.type === "high" ? "H" : "L"} ${e.time}`).join(" · ")
      : null,
    s.swell_max != null ? `swell ${s.swell_max} m${s.swell_period ? ` @ ${Math.round(s.swell_period)} s` : ""}` : null,
    s.wind_max_kn != null ? `wind to ${s.wind_max_kn} kn` : null,
    s.pressure != null
      ? `${s.pressure} hPa${s.pressure_trend != null ? ` (${s.pressure_trend > 0 ? "+" : ""}${s.pressure_trend}/24h)` : ""}`
      : null,
    s.rain_72h != null ? `rain 72h ${s.rain_72h} mm` : null,
    s.sst != null ? `water ${s.sst} °C` : null,
    `${s.moon_name.toLowerCase()} ${Math.round(s.moon_illum * 100)}%`,
  ];

  return (
    <main>
      {anyFlag && (
        <div className="banner safety">
          ⚠ ROCK PLATFORMS FLAGGED TODAY — swell beyond safe limits. The rock score is capped, not negotiated.
        </div>
      )}

      <div className="wrap">
        <header className="hero">
          <p className="dateline">
            {fmtDate(today.date)} · SYDNEY · CONDITIONS SCORED 0–100
          </p>
          <h1 className="headline">{today.headline}</h1>

          <div className="chips">
            {chips.filter(Boolean).map((c) => (
              <span className="chip" key={c as string}>{c}</span>
            ))}
            {s.sunrise && s.sunset && (
              <span className="chip">
                sun <b>{s.sunrise}</b>–<b>{s.sunset}</b>
              </span>
            )}
          </div>

          <TideCurve curve={today.tide_curve} events={s.tide_events} sunrise={s.sunrise} sunset={s.sunset} />
        </header>

        <section aria-labelledby="env-h">
          <div className="section-head">
            <h2 id="env-h">Where to fish today</h2>
            <span className="card-meta">same conditions, five different answers — <Link href="/methodology">why</Link></span>
          </div>
          <div className="env-grid">
            {today.environments.map((e) => (
              <ScoreCard env={e} key={e.id} />
            ))}
          </div>
        </section>

        <section aria-labelledby="sp-h">
          <div className="section-head">
            <h2 id="sp-h">Best targets today</h2>
            <span className="card-meta"><Link href="/species">how to rig for each →</Link></span>
          </div>
          <ol className="rank">
            {today.species.slice(0, 5).map((sp) => (
              <li key={sp.id}>
                <span className="sp-name">
                  <Link href={`/species#${sp.id}`}>{sp.name}</Link>
                  <span className="env-tag">{sp.environment_name.toUpperCase()}</span>
                  <span className="sp-reason">{sp.reason}</span>
                </span>
                <span className={`sp-score sp-score-cell t-${tier(sp.score)}`}>{sp.score}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="ol-h">
          <div className="section-head">
            <h2 id="ol-h">The week ahead</h2>
            <span className="card-meta">best environment per day</span>
          </div>
          <div className="outlook">
            {site.days.map((d) => {
              const best = d.environments.reduce((a, b) => (b.score > a.score ? b : a));
              const rockFlag = d.environments.some((e) => e.safety_flag);
              return (
                <div className="o-day" key={d.date}>
                  <div className="o-wd">{d.weekday.toUpperCase()}</div>
                  <div className={`o-score t-${tier(best.score)}`}>{best.score}</div>
                  <div className="o-env">{best.name}</div>
                  {rockFlag && <div className="o-flag">ROCKS ✕</div>}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
