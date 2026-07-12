import type { DaySummary } from "@/lib/types";

const I = {
  tide: <svg viewBox="0 0 24 24"><path d="M2 14c3-5 6-5 9 0s6 5 9 0" /><path d="M2 19h20" opacity=".4" /></svg>,
  wind: <svg viewBox="0 0 24 24"><path d="M3 8h11a3 3 0 1 0-3-3" /><path d="M3 13h15a3 3 0 1 1-3 3" /><path d="M3 18h7" /></svg>,
  swell: <svg viewBox="0 0 24 24"><path d="M2 16c2-7 5-9 8-6 2 2 1 4 4 4 2 0 3-2 8-8" /><path d="M2 20h20" opacity=".4" /></svg>,
  pressure: <svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8" /><path d="M12 13l4-4" /><path d="M9 3h6" /></svg>,
  rain: <svg viewBox="0 0 24 24"><path d="M8 3c-2 4-4 6-4 9a4 4 0 0 0 8 0c0-3-2-5-4-9z" /><path d="M17 10c-1.4 2.6-2.6 4-2.6 6a2.6 2.6 0 0 0 5.2 0c0-2-1.2-3.4-2.6-6z" /></svg>,
  water: <svg viewBox="0 0 24 24"><path d="M10 3v10a4 4 0 1 0 4 0V3z" /><path d="M10 7h4" opacity=".5" /></svg>,
  moon: <svg viewBox="0 0 24 24"><path d="M20 13.5A8 8 0 1 1 10.5 4 6.5 6.5 0 0 0 20 13.5z" /></svg>,
  sun: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.5 4.5l2 2M17.5 17.5l2 2M19.5 4.5l-2 2M6.5 17.5l-2 2" /></svg>,
};

export default function CondLog({ s }: { s: DaySummary }) {
  const tide = s.tide_events.length
    ? s.tide_events.map((e) => `${e.type === "high" ? "H" : "L"} ${e.time}`).join(" · ")
    : "no data";
  const cells: [React.ReactNode, string, string][] = [
    [I.tide, "TIDE", tide],
    [I.wind, "WIND", s.wind_max_kn != null ? `to ${s.wind_max_kn} kn` : "no data"],
    [I.swell, "SWELL", s.swell_max != null ? `${s.swell_max} m${s.swell_period ? ` @ ${Math.round(s.swell_period)} s` : ""}` : "no data"],
    [I.pressure, "PRESSURE", s.pressure != null ? `${s.pressure} hPa${s.pressure_trend != null ? ` · ${s.pressure_trend > 0 ? "+" : ""}${s.pressure_trend}/24h` : ""}` : "no data"],
    [I.rain, "RAIN 72H", s.rain_72h != null ? `${s.rain_72h} mm` : "no data"],
    [I.water, "WATER", s.sst != null ? `${s.sst} °C inshore` : "no data"],
    [I.moon, "MOON", `${s.moon_name.toLowerCase()} · ${Math.round(s.moon_illum * 100)}%`],
    [I.sun, "SUN", s.sunrise && s.sunset ? `${s.sunrise} → ${s.sunset}` : "no data"],
  ];
  return (
    <div className="log">
      {cells.map(([icon, label, val]) => (
        <div key={label}>
          {icon}
          <div>
            <b>{label}</b>
            <span>{val}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
