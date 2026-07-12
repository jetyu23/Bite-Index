import { tier } from "@/lib/data";
import type { EnvResult } from "@/lib/types";

export default function EnvRow({ env, best }: { env: EnvResult; best?: boolean }) {
  const t = tier(env.score);
  return (
    <div className={`row tb-${t[0]}${env.safety_flag ? " flagged" : ""}`} id={`env-${env.id}`}>
      {env.safety_flag ? (
        <div className="rstamp red">AVOID</div>
      ) : best ? (
        <div className="rstamp olive">BEST TODAY</div>
      ) : null}
      <div>
        <span className="nm">{env.name}</span>
        <span className={`tag c-${env.id}`}>{env.tag || env.tagline.toUpperCase()}</span>
        {!env.safety_flag && <span className="win">best {env.best_window}</span>}
        <span className="why">{env.reason}</span>
      </div>
      <div className={`sc ${t[0]}`}>
        <b>{env.score}</b>
        <i>{env.label.toUpperCase()}</i>
      </div>
      {env.safety_flag && env.safety_message && <div className="safety-inline">⚠ {env.safety_message}</div>}
      <div className={`meter ${t[0]}`}>
        <i style={{ width: `${env.score}%` }} />
        <u title="calibrated median day (50)" />
      </div>
      <details className="why-details">
        <summary>WHY THIS SCORE</summary>
        <table className="drivers">
          <tbody>
            {env.drivers.map((d) => (
              <tr key={d.metric}>
                <td>
                  <span className={`ev ev-${d.evidence}`} title={`${d.evidence} evidence`} />
                  {d.label}
                  {d.evidence === "low" && <span className="low-tag">LOW EVIDENCE</span>}
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
    </div>
  );
}
