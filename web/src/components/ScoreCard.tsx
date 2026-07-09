import { tier } from "@/lib/data";
import type { EnvResult } from "@/lib/types";

export default function ScoreCard({ env }: { env: EnvResult }) {
  const t = tier(env.score);
  const top = env.drivers.find((d) => d.note && !d.note.startsWith("no data"));
  return (
    <article className={`card${env.safety_flag ? " flagged" : ""}`} id={`env-${env.id}`}>
      <div className="card-top">
        <div>
          <h3>{env.name}</h3>
          <div className="tagline">{env.tagline}</div>
        </div>
        <div className="score-block">
          <div className={`score-num t-${t}`}>{env.score}</div>
          <div className={`score-word t-${t}`}>{env.label}</div>
        </div>
      </div>

      <div className="bar" role="img" aria-label={`Score ${env.score} out of 100`}>
        <i className={`b-${t}`} style={{ width: `${env.score}%` }} />
      </div>

      {env.safety_flag && env.safety_message ? (
        <p className="safety-msg">⚠ {env.safety_message}</p>
      ) : (
        <p className="card-meta">
          best window <b>{env.best_window}</b>
          {top?.note ? <> · {top.note}</> : null}
        </p>
      )}

      <details className="why">
        <summary>Why this score</summary>
        <table className="drivers">
          <tbody>
            {env.drivers.map((d) => (
              <tr key={d.metric}>
                <td>
                  <span className={`ev ev-${d.evidence}`} title={`${d.evidence} evidence`} />
                  {d.label}
                  {d.note ? <div className="note">{d.note}</div> : null}
                </td>
                <td className="val">{d.value}</td>
                <td className="sub">
                  {d.subscore} <span className="note">· w{d.weight_pct}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </article>
  );
}
