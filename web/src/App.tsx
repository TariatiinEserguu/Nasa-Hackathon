import { useCallback, useEffect, useMemo, useState } from "react";
import type { Body, Bundle, FactorId, Site, Target } from "./lib/data";
import { loadBundle, loadGrid } from "./lib/data";
import { cellValue, combine, distribution, fmt, fmtCoord, gridOverall, rampGradient, type Weights } from "./lib/score";
import { MapView, type MapSite } from "./components/MapView";
import { SiteDetail } from "./components/SiteDetail";
import { Pips } from "./components/charts";
import { Findings, Method, Portfolio } from "./components/Pages";

type View = "explore" | "findings" | "portfolio" | "method";
type Layer = "overall" | FactorId;
const VIEWS: { id: View; label: string }[] = [
  { id: "explore", label: "Explore" }, { id: "findings", label: "Findings" }, { id: "portfolio", label: "Portfolio" }, { id: "method", label: "Method & data" },
];

function readHash() {
  const [path, query] = window.location.hash.replace(/^#\/?/, "").split("?");
  const q = new URLSearchParams(query ?? "");
  return { view: (VIEWS.find((v) => v.id === path)?.id ?? "explore") as View, t: q.get("t"), s: q.get("s") };
}

export default function App() {
  const [b, setB] = useState<Bundle | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const init = useMemo(readHash, []);
  const [view, setView] = useState<View>(init.view);
  const [targetId, setTargetId] = useState<string>(init.t ?? "jezero");
  const [siteId, setSiteId] = useState<string | null>(init.s);
  const [profile, setProfile] = useState<string>("balanced");
  const [weights, setWeights] = useState<Weights | null>(null);
  const [layer, setLayer] = useState<Layer>("overall");
  const [kind, setKind] = useState<"all" | "known" | "candidate">("all");
  const [hideLow, setHideLow] = useState(false);
  const [overlay, setOverlay] = useState(true);
  const [grids, setGrids] = useState<{ id: string; g: Partial<Record<FactorId, Float32Array>> } | null>(null);

  useEffect(() => { loadBundle().then((x) => { setB(x); setWeights({ ...x.meta.profiles.balanced.w }); }).catch((e) => setErr(String(e.message ?? e))); }, []);
  useEffect(() => {
    const on = () => { const h = readHash(); setView(h.view); if (h.t) setTargetId(h.t); setSiteId(h.s); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  useEffect(() => {
    const q = new URLSearchParams();
    if (view === "explore") { q.set("t", targetId); if (siteId) q.set("s", siteId); }
    const h = `#/${view}${q.toString() ? "?" + q : ""}`;
    if (window.location.hash !== h) window.history.replaceState(null, "", h);
  }, [view, targetId, siteId]);

  const target: Target | undefined = b?.targets.find((t) => t.id === targetId) ?? b?.targets[0];
  const body: Body = target?.body ?? "mars";
  const gw = b?.meta.grid.nlon ?? 1440, gh = b?.meta.grid.nlat ?? 720;

  useEffect(() => {
    if (!b || !target) return;
    let live = true;
    Promise.all(Object.entries(target.grid).map(async ([k, p]) => [k, await loadGrid(p!, gw, gh)] as const)).then((pairs) => {
      if (live) setGrids({ id: target.id, g: Object.fromEntries(pairs) as any });
    });
    return () => { live = false; };
  }, [b, target?.id]);

  const overallGrid = useMemo(() => {
    if (!grids || !target || !weights || grids.id !== target.id) return null;
    return gridOverall(grids.g, target.factors, weights, gw * gh);
  }, [grids, weights, target?.id]);
  const dist = useMemo(() => (overallGrid ? distribution(overallGrid, gw, gh) : null), [overallGrid]);
  const shown = layer === "overall" ? overallGrid : grids && target && grids.id === target.id ? grids.g[layer] ?? null : null;
  const domain = useMemo<[number, number]>(() => {
    if (!shown) return [0, 1];
    const d = shown === overallGrid && dist ? dist : distribution(shown, gw, gh);
    return [d.quantile(0.7), Math.max(d.quantile(0.999), d.quantile(0.7) + 0.02)];
  }, [shown]);

  const ranked = useMemo(() => {
    if (!b || !target || !weights) return [] as { site: Site; overall: number; coverage: number }[];
    return b.sites.filter((s) => s.scores[target.id]).map((s) => ({ site: s, ...combine(s.scores[target.id].fac, s.scores[target.id].expected, weights) }))
      .filter((x) => Number.isFinite(x.overall)).sort((x, y) => y.overall - x.overall);
  }, [b, target?.id, weights]);
  const list = ranked.filter((x) => (kind === "all" || x.site.kind === kind) && (!hideLow || x.site.scores[target!.id].conf.label !== "low"));
  const mapSites: MapSite[] = useMemo(() => {
    const rk = new Map(list.slice(0, 8).map((x, i) => [x.site.id, i + 1]));
    return ranked.map((x) => ({ site: x.site, score: x.overall, rank: rk.get(x.site.id) ?? null }));
  }, [ranked, kind, hideLow]);

  const go = useCallback((v: View) => { setView(v); }, []);
  const openSite = useCallback((sid: string, tid?: string) => { if (tid) setTargetId(tid); setSiteId(sid); setView("explore"); }, []);
  const pickTarget = (id: string) => { setTargetId(id); setLayer("overall"); };
  const pickBody = (bd: Body) => { if (bd !== body && b) pickTarget(b.targets.find((t) => t.body === bd)!.id); };
  const pickProfile = (p: string) => { setProfile(p); if (b) setWeights({ ...b.meta.profiles[p].w }); };

  if (err) return <div className="loading">Could not load analysis data — {err}. Run the pipeline (see README) to generate web/public/data.</div>;
  if (!b || !target || !weights) return <div className="loading">LOADING ANALYSIS…</div>;

  const site = siteId ? b.sites.find((s) => s.id === siteId) : undefined;
  const sitePct = site && overallGrid && dist ? dist.pct(cellValue(overallGrid, gw, gh, site.lat, site.lon)) : NaN;
  const facLabel = (k: FactorId) => b.meta.factors.find((f) => f.id === k)!.label;
  const tf = (k: string, d = 0) => fmt(target.features[k]?.value, d);

  return (
    <div className="app" data-body={body}>
      <header className="topbar">
        <div className="brand">
          <svg width="26" height="18" viewBox="0 0 26 18" aria-hidden="true"><circle cx="9" cy="9" r="7" fill="none" stroke="#63c7b2" strokeWidth="1.6" /><circle cx="17" cy="9" r="7" fill="none" stroke="var(--accent)" strokeWidth="1.6" /></svg>
          <b>PLANETARY TWIN</b><span>Earth analogs for the Moon and Mars</span>
        </div>
        <nav className="nav" aria-label="Sections">
          {VIEWS.map((v) => <button key={v.id} aria-current={view === v.id ? "page" : undefined} onClick={() => go(v.id)}>{v.label}</button>)}
        </nav>
        <div className="spacer" />
        <div className="bodyswitch" role="group" aria-label="Planetary body">
          <button data-b="mars" aria-pressed={body === "mars"} onClick={() => pickBody("mars")}>MARS</button>
          <button data-b="moon" aria-pressed={body === "moon"} onClick={() => pickBody("moon")}>MOON</button>
        </div>
      </header>

      {view === "explore" && (
        <div className={`explore ${site ? "dossier-open" : ""}`}>
          <aside className="rail">
            <div className="section">
              <div className="label"><span>Reference region</span><span>{body}</span></div>
              <div className="tlist">
                {b.targets.filter((t) => t.body === body).map((t) => (
                  <button key={t.id} className="titem" aria-pressed={t.id === target.id} onClick={() => pickTarget(t.id)}>
                    <span className="n">{t.name}</span><span className="c">{Math.abs(t.lat).toFixed(1)}°{t.lat >= 0 ? "N" : "S"}</span>
                    <span className="s">{t.sub}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="section">
              <div className="label"><span>Mission profile</span><span>{profile === "custom" ? "custom" : ""}</span></div>
              <div className="chips">
                {Object.entries(b.meta.profiles).map(([k, p]) => <button key={k} className="chip" aria-pressed={profile === k} onClick={() => pickProfile(k)} title={p.blurb}>{p.label}</button>)}
              </div>
              <p className="note">{profile === "custom" ? "Custom weights. Map and rankings update live." : b.meta.profiles[profile].blurb}</p>
              {b.meta.factors.map((fa) => {
                const on = fa.id === "geology" ? target.geology_assessable.length > 0 : target.factors.includes(fa.id);
                return (
                  <div key={fa.id} className={`wrow ${on ? "" : "off"}`} title={on ? "" : "Not applicable to this reference region"}>
                    <span>{fa.label}</span>
                    <input type="range" min={0} max={4} step={0.25} value={weights[fa.id]} disabled={!on} aria-label={`${fa.label} weight`}
                      onChange={(e) => { setProfile("custom"); setWeights({ ...weights, [fa.id]: Number(e.target.value) }); }} />
                    <span className="num">{weights[fa.id].toFixed(2)}</span>
                  </div>
                );
              })}
              <p className="note">Geology is scored only for listed sites (it needs a map lookup), so it re-orders the ranking but not the global layer.</p>
            </div>
            <div className="section">
              <div className="label"><span>Map layer</span><button onClick={() => setOverlay(!overlay)} style={{ color: "var(--muted)" }}>{overlay ? "hide" : "show"}</button></div>
              <div className="legendbar" style={{ background: rampGradient(body) }} />
              <div className="legendticks"><span>{fmt(domain[0], 2)}</span><span>{layer === "overall" ? "similarity" : facLabel(layer as FactorId).toLowerCase() + " score"}</span><span>{fmt(domain[1], 2)}</span></div>
              <p className="note">Colour shows the best-scoring 30% of Earth's land for this layer; the rest is left clear. Cells are 0.25°.</p>
              <div className="keyrow"><span className="dot known" />Established analog (validation set)</div>
              <div className="keyrow"><span className="dot cand" />Candidate surfaced by the scan</div>
            </div>
            <div className="section">
              <div className="label"><span>{target.name}</span><span>measured</span></div>
              <table className="ftable"><tbody>
                <tr><td className="l">Median slope</td><td className="n">{tf("slope_med", 2)}°</td></tr>
                <tr><td className="l">Relief in 61 km</td><td className="n">{tf("relief")} m</td></tr>
                <tr><td className="l">Mean temperature</td><td className="n">{tf("t_mean")} K</td></tr>
                <tr><td className="l">Daily swing</td><td className="n">{tf("t_dtr")} K</td></tr>
                <tr><td className="l">Albedo</td><td className="n">{tf("albedo", 2)}</td></tr>
                {body === "mars" && <tr><td className="l">Pressure</td><td className="n">{tf("pressure", 2)} kPa</td></tr>}
              </tbody></table>
              <p className="note">{target.mission}. {fmtCoord(target.lat, target.lon)}</p>
            </div>
          </aside>

          <div className="mapwrap">
            <MapView grid={shown} w={gw} h={gh} rampName={body} domain={domain} sites={mapSites} selected={siteId} onSelect={setSiteId} showOverlay={overlay} />
            <div className="maphud">
              <div className="hudcard">
                <div className="label">Where on Earth resembles</div>
                <h2>{target.name}</h2>
                <div className="small muted">{target.sub}</div>
              </div>
              <div className="segs" role="group" aria-label="Layer">
                <button aria-pressed={layer === "overall"} onClick={() => setLayer("overall")}>Overall</button>
                {target.factors.map((k) => <button key={k} aria-pressed={layer === k} onClick={() => setLayer(k)}>{facLabel(k)}</button>)}
              </div>
            </div>
            <div className="mapfoot">{b.meta.grid.land_cells.toLocaleString()} land cells scored · {b.meta.grid.deg}° grid · basemap: Sentinel-2 cloudless 2020 by EOX (contains modified Copernicus Sentinel data)</div>
          </div>

          <aside className="side">
            {site && site.scores[target.id] ? (
              <SiteDetail key={site.id + target.id} b={b} site={site} target={target} weights={weights} pct={sitePct} onBack={() => setSiteId(null)} onTarget={pickTarget} />
            ) : (
              <>
                <div className="section">
                  <div className="label"><span>Ranking · {list.length} sites</span><span>similarity</span></div>
                  <div className="filters">
                    {(["all", "known", "candidate"] as const).map((k) => <button key={k} className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{k === "all" ? "All" : k === "known" ? "Established" : "New candidates"}</button>)}
                    <button className="chip" aria-pressed={hideLow} onClick={() => setHideLow(!hideLow)}>Hide low confidence</button>
                  </div>
                </div>
                {list.slice(0, 40).map((x, i) => {
                  const sc = x.site.scores[target.id];
                  return (
                    <button key={x.site.id} className="rk" onClick={() => setSiteId(x.site.id)}>
                      <span className="r">{String(i + 1).padStart(2, "0")}</span>
                      <span className="nm" title={x.site.name}>{x.site.name}</span>
                      <span className="sc">{fmt(x.overall, 2)}</span>
                      <span className="meta">
                        <span className={`tag ${x.site.kind === "known" ? "known" : "cand"}`}>{x.site.kind === "known" ? "established" : "candidate"}</span>
                        <Pips expected={sc.expected} matched={sc.matched} have={(k) => sc.fac[k as FactorId] != null} />
                        <span className="num">{sc.matched.length}/{sc.expected.length}</span>
                        <span className={`conf ${sc.conf.label}`}>{sc.conf.label}</span>
                        <span className="num dim">{Math.abs(x.site.lat).toFixed(1)}°{x.site.lat >= 0 ? "N" : "S"} {Math.abs(x.site.lon).toFixed(1)}°{x.site.lon >= 0 ? "E" : "W"}</span>
                      </span>
                    </button>
                  );
                })}
                <div className="section"><p className="note">Squares show which dimensions reach the match threshold ({b.meta.params.match_threshold}). Similarity and confidence are separate: a high score with low confidence is a lead, not a conclusion.</p></div>
              </>
            )}
          </aside>
        </div>
      )}
      {view === "findings" && <Findings b={b} openSite={openSite} />}
      {view === "portfolio" && <Portfolio b={b} openSite={openSite} />}
      {view === "method" && <Method b={b} openSite={openSite} />}
    </div>
  );
}
