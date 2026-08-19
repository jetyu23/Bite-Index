/* Species artwork, one supplied illustration per species (owner-provided,
   replacing the earlier hand-drawn SVG set). Files live in
   web/public/fish/<id>.png, named to match each species' id exactly.
   Lazy-loaded since a full species page loads all 12 at once. */

const SPECIES_WITH_ART = new Set([
  "mulloway",
  "kingfish",
  "bream",
  "tailor",
  "trevally",
  "squid",
  "yakkas",
  "salmon",
  "flathead",
  "luderick",
  "whiting",
  "snapper",
]);

export default function FishSilhouette({ id }: { id: string }) {
  if (!SPECIES_WITH_ART.has(id)) return null;
  return (
    <div className="fish-silhouette">
      {/* eslint-disable-next-line @next/next/no-img-element -- static export, images.unoptimized is already set */}
      <img src={`/fish/${id}.png`} alt="" loading="lazy" decoding="async" />
    </div>
  );
}
