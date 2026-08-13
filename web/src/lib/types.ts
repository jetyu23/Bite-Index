export interface Driver {
  metric: string;
  label: string;
  value: string;
  subscore: number;
  weight_pct: number;
  evidence: "strong" | "moderate" | "low";
  note: string;
}

export interface EnvResult {
  id: string;
  name: string;
  tagline: string;
  tag?: string;
  /** Raw, uncalibrated 0-100 score of the best session -- the headline number and tier label. */
  score: number;
  /** Mean raw score across all of this ground's sessions, not just the best one --
   *  "is today worth going at all", as distinct from "when's the best moment". */
  session_mean: number;
  /** Which named session produced the headline score, e.g. "dawn". */
  best_session: string;
  /** Raw score rescaled for display: a hand-set curve anchored on robust percentiles
   *  (p1/p10/p90/p99) pooled across ALL profiles, not just this one, so equal raw
   *  quality displays equally regardless of which ground or species it's from.
   *  Ordinary days land around 40-70; exceptional days reach further and do so
   *  rarely. Null when no calibration exists yet, or a safety cap overrides scoring. */
  calibrated: number | null;
  /** This ground's raw-score median day, for positioning the meter's reference tick. */
  raw_median: number | null;
  reason: string;
  label: string;
  best_window: string;
  safety_flag: boolean;
  safety_message: string | null;
  drivers: Driver[];
}

export interface SpeciesResult {
  id: string;
  name: string;
  tag?: string;
  /** Species' own raw, uncalibrated score -- not blended with its routed environment. */
  score: number;
  /** Mean raw score across all of this species' sessions, not just the best one. */
  session_mean: number;
  /** Which named session produced the headline score, e.g. "dusk". */
  best_session: string;
  /** That raw score rescaled for display, same pooled-anchor curve as EnvResult.calibrated. */
  calibrated: number | null;
  label: string;
  environment: string;
  environment_name: string;
  best_window: string;
  reason: string;
  /** Calibrated, environment-blended value this list is sorted by. Not a headline number. */
  rank_score?: number;
}

export interface TideEvent {
  time: string;
  type: "high" | "low";
  height: number;
}

export interface DaySummary {
  sunrise: string | null;
  sunset: string | null;
  moon_name: string;
  moon_illum: number;
  tide_events: TideEvent[];
  tide_range: number | null;
  swell_max: number | null;
  swell_period: number | null;
  wind_max_kn: number | null;
  pressure: number | null;
  pressure_trend: number | null;
  rain_24h: number | null;
  rain_72h: number | null;
  rain_today: number | null;
  sst: number | null;
}

export interface Day {
  date: string;
  weekday: string;
  headline: string;
  summary: DaySummary;
  tide_curve: { t: string; h: number }[];
  environments: EnvResult[];
  species: SpeciesResult[];
}

export interface SiteData {
  generated_at: string;
  source: string;
  calibration?: { applied: boolean; window: string[] | null; n_days: number };
  warnings: string[];
  location: { name: string; lat: number; lon: number };
  score_labels: { min: number; label: string }[];
  days: Day[];
}

export interface FactorDef {
  label: string;
  unit: string;
  plain?: string;
  fmt: string;
  granularity: string;
  evidence: "strong" | "moderate" | "low";
  description: string;
  note_pos: string;
  note_neg: string;
}

export interface ProfileFactor {
  metric: string;
  weight: number;
  type?: "curve" | "table" | "season";
  points?: number[][];
  map?: Record<string, number>;
  season?: number[];
  justification: string;
}

export interface ProfileGate {
  metric: string;
  points: number[][];
  note: string;
  justification: string;
}

export interface EnvProfile {
  id: string;
  name: string;
  tagline: string;
  tag?: string;
  sessions: string[];
  safety?: {
    metric_max_swell_m: number;
    long_period_swell_m: number;
    long_period_s: number;
    cap: number;
    message: string;
  };
  factors: ProfileFactor[];
  gates?: ProfileGate[];
}

export interface SpeciesGuide {
  difficulty: string;
  baits: string[];
  lures: string[];
  rigs: string[];
  rig_diagram: string;
  line: string;
  leader: string;
  rod: string;
  knots: string[];
  season_notes: string;
  habitat: string;
  hot_tip?: string;
  safety_note: string | null;
}

export interface SpeciesProfile {
  id: string;
  name: string;
  tag?: string;
  env_blend: number;
  sessions: string[];
  environments: Record<string, number>;
  factors: ProfileFactor[];
  gates?: ProfileGate[];
  guide: SpeciesGuide;
}

export interface Profiles {
  factors: {
    metrics: Record<string, FactorDef>;
    score_labels: { min: number; label: string }[];
    sessions: Record<string, number[]>;
  };
  environments: EnvProfile[];
  species: SpeciesProfile[];
}
