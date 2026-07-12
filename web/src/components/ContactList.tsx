import Link from "next/link";
import { shortEnv, tier } from "@/lib/data";
import type { SpeciesResult } from "@/lib/types";

/* Distinct from the ledger on purpose: the ledger is five equal grounds, so it
   reads as equal rows. The contact list is a RANKING, so it reads as a podium
   (top three get weight and a score bar) then a compact table for the rest.
   Same data discipline, different shape, so the two sections stop looking like
   the same component twice. */

function envClass(id: string): string {
  return `c-${id}`;
}

export default function ContactList({ species }: { species: SpeciesResult[] }) {
  const podium = species.slice(0, 3);
  const rest = species.slice(3);
  return (
    <div className="contacts">
      <div className="podium">
        {podium.map((sp, i) => {
          const t = tier(sp.score)[0];
          return (
            <Link href={`/species#${sp.id}`} className={`pod pod-${i + 1}`} key={sp.id}>
              <div className="pod-rank">{i === 0 ? "PRIME" : `No.${i + 1}`}</div>
              <div className="pod-name">{sp.name}</div>
              <div className={`pod-tag ${envClass(sp.environment)}`}>{sp.tag || shortEnv(sp.environment_name).toUpperCase()}</div>
              <div className="pod-win">{sp.best_window}</div>
              <div className={`pod-bar ${t}`}><i style={{ width: `${sp.score}%` }} /></div>
              <div className={`pod-score ${t}`}>{sp.score}<span>{sp.label}</span></div>
              <div className="pod-why">{sp.reason}</div>
            </Link>
          );
        })}
      </div>

      <table className="ctable">
        <tbody>
          {rest.map((sp, i) => {
            const t = tier(sp.score)[0];
            return (
              <tr key={sp.id}>
                <td className="ct-rk">{String(i + 4).padStart(2, "0")}</td>
                <td className="ct-nm"><Link href={`/species#${sp.id}`}>{sp.name}</Link></td>
                <td><span className={`tag ${envClass(sp.environment)}`}>{sp.tag || shortEnv(sp.environment_name).toUpperCase()}</span></td>
                <td className="ct-win">{sp.best_window}</td>
                <td className="ct-bar"><span className={`minibar ${t}`}><i style={{ width: `${sp.score}%` }} /></span></td>
                <td className={`ct-sc ${t}`}>{sp.score}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
