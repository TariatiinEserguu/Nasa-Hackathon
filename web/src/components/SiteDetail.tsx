import { useMemo, useState } from "react";
import type { Bundle, FactorId, FeatureDef, Site, Target } from "../lib/data";
import { asset } from "../lib/data";
import { combine, fmt, fmtCoord, smart, type Weights } from "../lib/score";
import { Pips, ProfileChart, Relief, SlopeChart, ThermalChart, TINT, bodyColor, reliefExag } from "./charts";

const SITE_KEY: Record<string, string> = { slope: "slope_med", relief: "relief", hurst: "hurst", t_mean: "t_mean", t_dtr: "t_dtr", t_cold: "t_cold",
  precip: "precip", albedo: "albedo", bare: "ndvi", pressure: "pressure", dust: "dust", tqv: "tqv", cryo: "t_mean", frozen: "frozen" };
const TARGET_KEY: Record<string, string> = { slope: "slope_med", relief: "relief", hurst: "hurst", t_mean: "t_mean", t_dtr: "t_dtr", t_cold: "t_cold",
  precip: "precip", albedo: "albedo", bare: "ndvi", pressure: "pressure", dust: "dust", tqv: "tqv" };
const METHOD: Record<string, string> = { distribution: "distribution match", direct: "direct match", direct_log: "direct match (log)", gap: "gap closure",
  gap_log: "gap closure (log)", proxy_cryo: "proxy", proxy_frozen: "proxy" };

export function describe(fid: FactorId, site: Site, target: Target, b: Bundle): string {
  const f = site.features!, t = (k: string) => target.features[k]?.value, sc = site.scores[target.id];
  const pc = (k: string) => (sc.f[k] == null ? "—" : `${Math.round(sc.f[k]! * 100)}%`);
  const L = b.meta.geology.labels;
  switch (fid) {
    case "terrain": return `Median slope ${fmt(f.slope_med, 2)}° against ${fmt(t("slope_med"), 2)}°, and ${smart(f.relief)} m of relief against ${smart(t("relief"))} m across the same 61 km window.`;
    case "surface": return `Shortwave albedo ${fmt(f.albedo, 2)} against ${fmt(t("albedo"), 2)}; peak NDVI ${fmt(f.ndvi, 2)} (bare ground is ≤ 0.08).`;
    case "aridity": return `${smart(f.precip)} mm of precipitation a year: ${pc("precip")} of the way from typical Earth land to no rain at all (scores saturate at 10 mm/yr, the precision of the rainfall products).`;
    case "thermal": return `Mean surface temperature ${fmt(f.t_mean, 0)} K against ${fmt(t("t_mean"), 0)} K closes ${pc("t_mean")} of the gap from typical Earth land; the daily swing is ${fmt(f.t_dtr, 0)} K against ${fmt(t("t_dtr"), 0)} K (${pc("t_dtr")}).`;
    case "atmosphere": return `Surface pressure ${fmt(f.pressure, 0)} kPa against ${fmt(t("pressure"), 2)} kPa (${pc("pressure")} of the gap on a log scale); aerosol optical depth ${fmt(f.dust, 2)} against a dust optical depth of ${fmt(t("dust"), 2)}.`;
    case "ice": return `Surface frozen ${Math.round((f.frozen ?? 0) * 12)} months of the year with a mean of ${fmt(f.t_mean, 0)} K — a temperature-based proxy for ground that can hold ice, not a detection of ice.`;
    case "geology": {
      const have = site.geology?.classes.map((c) => L[c] ?? c).join(", ") || "no mapped units";
      const want = target.geology_assessable.map((c) => L[c] ?? c).join(", ");
      return `Mapped at the site: ${have}. Documented at ${target.name}: ${want}.`;
    }
  }
}

function applications(site: Site, target: Target, matched: FactorId[]): string[] {
  const out: string[] = [], sc = site.scores[target.id], g = site.geology?.classes ?? [];
  const body = target.body === "mars" ? "Mars" : "lunar";
  if (matched.includes("terrain")) out.push(`Traverse planning, navigation and long-range mobility trials on slopes statistically like ${target.name} at kilometre scale.`);
  if (matched.includes("surface")) out.push(`Camera, spectrometer and thermal-instrument field calibration over bare ground with a similar albedo.`);
  if (matched.includes("aridity")) out.push(`Life-detection, contamination-control and soil-chemistry protocols in ground that almost never sees liquid water.`);
  if (matched.includes("ice") || (sc.fac.ice ?? 0) >= 0.5) out.push(`Rehearsal of drilling and sampling in frozen ground for ${target.body === "mars" ? "Martian ground ice" : "lunar polar volatiles"} — at far milder temperatures than the real thing.`);
  if ((sc.fac.thermal ?? 0) >= 0.3) out.push(`Cold-soak and thermal-cycling tests of hardware; the site closes ${Math.round((sc.fac.thermal ?? 0) * 100)}% of the thermal gap, more than most of Earth.`);
  if (g.includes("volc_mafic") && target.geology.includes("volc_mafic")) out.push(`Field geology and resource-processing studies on basaltic rock, the documented lithology at ${target.name}.`);
  if (g.includes("evaporite") && target.geology.includes("evaporite")) out.push(`Salt and sulfate mineralogy studies relevant to the evaporite-bearing strata at ${target.name}.`);
  if ((site.features!.pressure ?? 101) < 62) out.push(`Human-factors and equipment work at roughly half sea-level pressure (still ~${Math.round((site.features!.pressure ?? 0) / (target.features.pressure?.value ?? 0.7))}× the ${body} surface value).`);
  if (!out.length) out.push("No dimension reaches the match threshold for this reference region; the site is better used for a different target (see the comparison below).");
  return out;
}

export function SiteDetail({ b, site, target, weights, pct, onBack, onTarget }:
  { b: Bundle; site: Site; target: Target; weights: Weights; pct: number; onBack: () => void; onTarget: (id: string) => void }) {
  const [view, setView] = useState<"image" | "relief">("image");
  const sc = site.scores[target.id];
  const { overall, coverage } = combine(sc.fac, sc.expected, weights);
  const cb = bodyColor(target.body);
  const exag = useMemo(() => reliefExag(site.window, target.window), [site, target]);
  const TH = b.meta.params.match_threshold;
  const facs = sc.expected.map((k) => ({ k, v: sc.fac[k] })).filter((x) => x.v != null) as { k: FactorId; v: number }[];
  const sorted = [...facs].sort((a, c) => c.v - a.v);
  const label = (k: FactorId) => b.meta.factors.find((f) => f.id === k)!.label;
  const hasImg = b.imagery.sites[site.id];
  const feats = (k: FactorId) => b.meta.features.filter((f) => f.factor === k && f.id in sc.f);
  const f = site.features!;
  const best = (body: string) => b.targets.filter((t) => t.body === body).map((t) => ({ t, o: site.scores[t.id]?.overall.balanced ?? 0 })).sort((x, y) => y.o - x.o)[0]?.t;
  const [marsId, setMarsId] = useState<string | null>(null), [moonId, setMoonId] = useState<string | null>(null);
  const mars = b.targets.find((t) => t.id === marsId) ?? (target.body === "mars" ? target : best("mars")), moon = b.targets.find((t) => t.id === moonId) ?? (target.body === "moon" ? target : best("moon"));
  const triExag = Math.min(reliefExag(site.window, mars.window), reliefExag(site.window, moon.window));

  const row = (fd: FeatureDef) => {
    const ev = f[SITE_KEY[fd.id]] as number | null, tk = TARGET_KEY[fd.id], tf = tk ? target.features[tk] : undefined;
    const tval = fd.id === "bare" ? "none" : fd.id === "cryo" ? "ground ice" : fd.id === "frozen" ? "always" : tf ? smart(tf.value, fd.unit === "deg" ? "°" : fd.unit) : "—";
    const eval_ = fd.id === "frozen" ? `${Math.round((ev ?? 0) * 12)} / 12 mo` : smart(ev, fd.unit === "deg" ? "°" : fd.unit);
    return (
      <tr key={fd.id}>
        <td className="l">{fd.label}<span className="m">{METHOD[fd.method]} · Earth <span className={`tag ${fd.earth_kind}`}>{fd.earth_kind}</span>{tf && <> {target.body === "mars" ? "Mars" : "Moon"} <span className={`tag ${tf.kind}`}>{tf.kind}</span></>}</span></td>
        <td className="n"><span className="e-c">{eval_}</span><span className="vs">vs</span><span className="p-c">{tval}</span></td>
        <td className="n s">{fmt(sc.f[fd.id], 2)}</td>
      </tr>
    );
  };

  return (
    <div>
      <div className="dhead">
        <button className="back" onClick={onBack}>← Rankings for {target.name}</button>
        <h2>{site.name}</h2>
        <div className="small muted num">{fmtCoord(site.lat, site.lon)} · {smart(f.elev)} m · <span className={`tag ${site.kind === "known" ? "known" : "cand"}`}>{site.kind === "known" ? "established analog" : "scan candidate"}</span>
          {site.nearest_known && <> · {site.nearest_known.km} km from nearest established analog</>}</div>
        <div className="kpis">
          <div className="kpi"><div className="label k">Similarity</div><div className="v" style={{ color: cb }}>{fmt(overall, 2)}</div><div className="tiny muted">to {target.name}</div></div>
          <div className="kpi"><div className="label k">Dimensions</div><div className="v">{sc.matched.length}<small> / {sc.expected.length}</small></div><Pips expected={sc.expected} matched={sc.matched} have={(k) => sc.fac[k as FactorId] != null} /></div>
          <div className="kpi"><div className="label k">Earth rank</div><div className="v">{Number.isFinite(pct) ? (pct >= 99.95 ? "top 0.1" : `top ${(100 - pct).toFixed(pct > 99 ? 1 : 0)}`) : "—"}<small>%</small></div><div className="tiny muted">of land, before geology</div></div>
          <div className="kpi"><div className="label k">Confidence</div><div className="v" style={{ fontSize: 17, paddingTop: 3 }}><span className={`conf ${sc.conf.label}`}>{sc.conf.label}</span></div><div className="tiny muted">coverage {Math.round(coverage * 100)}%</div></div>
        </div>
      </div>

      {site.known && (
        <div className="dsec">
          <h3>Established use</h3>
          <p className="prose">{site.known.note}</p>
          <p className="credit">{site.known.ref} · used for {site.known.for_.join(" and ")} · basis: {site.known.basis.map((x) => ({ env: "environment", geo: "geology", ops: "operations heritage" } as any)[x]).join(", ")}</p>
        </div>
      )}

      <div className="dsec">
        <h3>What matches, what does not</h3>
        <ul className="plain">
          {sorted.map((x) => <li key={x.k} className={x.v >= TH ? "plus" : "minus"}><b>{label(x.k)} {fmt(x.v, 2)}{x.v >= TH ? " — matched" : ""}.</b> {describe(x.k, site, target, b)}</li>)}
        </ul>
      </div>

      <div className="dsec">
        <h3><span>Same footprint, same scale · {b.imagery.footprint_km.toFixed(0)} km</span>
          <span className="tabs2"><button aria-pressed={view === "image"} onClick={() => setView("image")}>Imagery</button><button aria-pressed={view === "relief"} onClick={() => setView("relief")}>Relief</button></span></h3>
        <div className="twocol">
          <div>
            <div className="frame">
              {view === "image" ? (hasImg ? <img src={asset(`img/sites/${site.id}.jpg`)} alt={`Satellite image of ${site.name}`} loading="lazy" /> : <div className="empty">No usable imagery snapshot for this site (featureless snow or no mosaic coverage). Switch to Relief.</div>)
                : <Relief win={site.window} stepKm={b.meta.window.step_km} exag={exag} tint={TINT.earth} />}
              <div className="cap e">Earth</div><div className="scale" style={{ width: "32.9%" }}>20 km</div>
            </div>
            <div className="credit">{view === "image" ? b.imagery.site_credit : `ETOPO 2022 shaded relief · vertical exaggeration ×${exag}`}</div>
          </div>
          <div>
            <div className="frame">
              {view === "image" ? <img src={asset(`img/targets/${target.id}.jpg`)} alt={`Orbital image of ${target.name}`} loading="lazy" />
                : <Relief win={target.window} stepKm={b.meta.window.step_km} exag={exag} tint={TINT[target.body]} />}
              <div className="cap p">{target.name}</div><div className="scale" style={{ width: "32.9%" }}>20 km</div>
            </div>
            <div className="credit">{view === "image" ? b.imagery.targets[target.id] : `${target.body === "mars" ? "MOLA" : "LOLA"} shaded relief · vertical exaggeration ×${exag}`}</div>
          </div>
        </div>
        <p className="note">Imagery is for orientation only and never enters a score. Relief is drawn from the exact elevation samples the terrain score uses.</p>
      </div>

      <div className="dsec">
        <h3>Terrain · elevation profile through the window centre</h3>
        <ProfileChart a={site.profile} b={target.profile} stepKm={b.meta.window.step_km} la={site.name} lb={target.name} cb={cb} />
        <h3 style={{ marginTop: 18 }}>Terrain · slope distribution</h3>
        <SlopeChart qa={f.slope_q as unknown as number[]} qb={target.slope_q} qs={b.meta.slope_q} la={site.name} lb={target.name} cb={cb} />
        <p className="credit">Earth: NOAA ETOPO 2022 (1.85 km). {target.body === "mars" ? "Mars: MGS MOLA MEGDR 32 px/deg (1.85 km)." : "Moon: LRO LOLA LDEM 16 px/deg (1.90 km)."} Identical sampling on both bodies.</p>
      </div>

      <div className="dsec">
        <h3>Thermal · kelvin</h3>
        <ThermalChart target={target} site={site} />
        <p className="credit">Earth: MERRA-2 skin temperature sharpened with MODIS LST ({site.sources?.thermal === "MODIS" ? "MODIS detail available" : "no MODIS detail here"}). {target.features.t_mean?.source}.</p>
      </div>

      <div className="dsec">
        <h3><span>Score breakdown</span><span>score 0–1</span></h3>
        {sc.expected.map((k) => (
          <div className="fac" key={k}>
            <div className="fachead">
              <span className="fn">{label(k)}</span>
              <div className="bar"><i style={{ width: `${(sc.fac[k] ?? 0) * 100}%`, opacity: sc.fac[k] == null ? 0 : 1 }} /><u style={{ left: `${TH * 100}%` }} /></div>
              <span className="v">{sc.fac[k] == null ? "n/a" : fmt(sc.fac[k], 2)}</span>
            </div>
            {k === "geology" ? (
              <table className="ftable"><tbody>
                {sc.geo.length ? sc.geo.map((g) => (
                  <tr key={g.target}><td className="l">{b.meta.geology.labels[g.target]}<span className="m">category affinity · <span className="tag category">compiled maps</span></span></td>
                    <td className="n"><span className="e-c">{g.match ? b.meta.geology.labels[g.match] : "not mapped"}</span></td><td className="n s">{fmt(g.affinity, 2)}</td></tr>
                )) : <tr><td className="l">No lithology data returned for this point — geology is excluded from the score and lowers coverage.</td></tr>}
              </tbody></table>
            ) : <table className="ftable"><tbody>{feats(k).map(row)}</tbody></table>}
          </div>
        ))}
        <p className="note">The tick on each bar marks the match threshold ({TH}). Factors combine as a weighted geometric mean, so one failed dimension cannot be bought back by another.</p>
      </div>

      <div className="dsec">
        <h3>Confidence — kept separate from similarity</h3>
        <div className="meters">
          <div className="meter"><div className="label">Evidence coverage</div><div className="v">{Math.round(sc.conf.coverage * 100)}%</div><div className="bar"><i style={{ width: `${sc.conf.coverage * 100}%`, background: "var(--earth)" }} /></div><div className="tiny muted" style={{ marginTop: 6 }}>share of the profile backed by data</div></div>
          <div className="meter"><div className="label">Evidence quality</div><div className="v">{fmt(sc.conf.evidence, 2)}</div><div className="bar"><i style={{ width: `${sc.conf.evidence * 100}%`, background: "var(--earth)" }} /></div><div className="tiny muted" style={{ marginTop: 6 }}>measured 1.0 · model 0.7 · proxy 0.5</div></div>
          <div className="meter"><div className="label">Rank stability</div><div className="v">{fmt(sc.conf.stability, 2)}</div><div className="bar"><i style={{ width: `${sc.conf.stability * 100}%`, background: "var(--earth)" }} /></div><div className="tiny muted" style={{ marginTop: 6 }}>percentile {fmt(sc.conf.pct_p10, 1)}–{fmt(sc.conf.pct_p90, 1)} over {b.meta.sensitivity.runs} perturbed runs</div></div>
        </div>
        <p className="note">Cross-checks at this cell — temperature: MODIS {fmt(f.modis_t_mean, 0)} K vs MERRA-2 {fmt(f.merra_t_mean, 0)} K · precipitation: IMERG {smart(f.imerg_precip)} vs MERRA-2 {smart(f.merra_precip)} mm/yr · albedo: MODIS {fmt(f.modis_albedo, 2)} vs CERES {fmt(f.ceres_albedo, 2)}.</p>
      </div>

      <div className="dsec">
        <h3>Geological context</h3>
        <p className="prose"><b>{target.name}:</b> {target.geology_note} <span className="dim">({target.geology_ref})</span></p>
        {site.geology?.units.length ? site.geology.units.slice(0, 3).map((u, i) => (
          <div className="unit" key={i}>
            <div className="u1"><b>{u.name || u.lith || "Unnamed unit"}</b><span className="tag">{u.scale} scale</span></div>
            <div className="muted">{u.lith}{u.age ? ` · ${u.age}` : ""}</div>
            {u.ref && <div className="credit">{u.ref}</div>}
          </div>
        )) : <p className="note">Macrostrat returned no mapped unit at this point.</p>}
        <p className="credit">Lithology from Macrostrat (CC-BY 4.0). Not assessed from maps: {target.geology.filter((c) => b.meta.geology.unassessed.includes(c)).map((c) => b.meta.geology.labels[c]).join(", ") || "—"}.</p>
      </div>

      <div className="dsec">
        <h3>What this site could be used for</h3>
        <ul className="plain">{applications(site, target, sc.matched).map((a, i) => <li key={i}>{a}</li>)}</ul>
      </div>

      <div className="dsec">
        <h3>Earth · Mars · Moon at the same scale</h3>
        <div className="tri">
          {[{ body: "earth", name: site.name, win: site.window, t: null as Target | null }, { body: "mars", name: mars.name, win: mars.window, t: mars }, { body: "moon", name: moon.name, win: moon.window, t: moon }].map((c) => {
            const v = (k: string) => (c.t ? c.t.features[k]?.value : (f[k] as number | null));
            return (
              <div key={c.body}>
                <div className="frame"><Relief win={c.win} stepKm={b.meta.window.step_km} exag={triExag} tint={TINT[c.body]} /><div className={`cap ${c.body === "earth" ? "e" : c.body}`}>{c.body}</div></div>
                {c.t ? (
                  <select className="sel" style={{ marginTop: 8 }} value={c.t.id} onChange={(e) => (c.body === "mars" ? setMarsId : setMoonId)(e.target.value)} aria-label={`${c.body} reference region`}>
                    {b.targets.filter((t) => t.body === c.body).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                ) : <h4>{c.name}</h4>}
                <div className="kv">
                  <span>Median slope</span><span>{fmt(v("slope_med"), 2)}°</span>
                  <span>Relief</span><span>{smart(v("relief"))} m</span>
                  <span>Mean temperature</span><span>{fmt(v("t_mean"), 0)} K</span>
                  <span>Daily swing</span><span>{fmt(v("t_dtr"), 0)} K</span>
                  <span>Albedo</span><span>{fmt(v("albedo"), 2)}</span>
                  <span>Pressure</span><span>{c.body === "moon" ? "vacuum" : `${smart(v("pressure"))} kPa`}</span>
                  {c.t && <><span>Similarity to site</span><span style={{ color: bodyColor(c.body) }}>{fmt(site.scores[c.t.id]?.overall.balanced, 2)}</span></>}
                </div>
                {c.t && c.t.id !== target.id && <button className="chip" style={{ marginTop: 8 }} onClick={() => onTarget(c.t!.id)}>Compare against this →</button>}
              </div>
            );
          })}
        </div>
        <p className="credit">Relief: ETOPO 2022, MOLA, LOLA at ~1.9 km sampling, shared vertical exaggeration ×{triExag}. Mars temperatures and pressure are Mars Climate Database model values; lunar temperatures are Diviner measurements.</p>
      </div>

      <div className="dsec">
        <div className="callout"><b>Read this before visiting.</b> No site on Earth reproduces {target.body === "mars" ? "0.38 g, a 0.6 kPa CO₂ atmosphere" : "0.17 g, hard vacuum"} or the surface radiation environment. The score says the measured variables resemble {target.name}; it is an argument for field work, not a replacement for it.</div>
      </div>
    </div>
  );
}
