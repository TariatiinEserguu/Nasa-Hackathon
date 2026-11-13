import type { Bundle, FactorId, Site, Target } from "../lib/data";
import { asset } from "../lib/data";
import { fmt, fmtCoord, rampCss, smart } from "../lib/score";
import { Pips, Relief, TINT, bodyColor, reliefExag } from "./charts";
import { describe } from "./SiteDetail";

type Open = (siteId: string, targetId?: string) => void;
const tname = (b: Bundle, id: string) => b.targets.find((t) => t.id === id)?.name ?? id;
const flabel = (b: Bundle, k: string) => b.meta.factors.find((f) => f.id === k)?.label ?? k;

/* ------------------------------------------------------------------ FINDINGS */
export function Findings({ b, openSite }: { b: Bundle; openSite: Open }) {
  const v = b.validation, env = v.env.balanced;
  const lead = b.findings[0];
  const leadSite = lead && b.sites.find((s) => s.id === lead.site);
  const leadSc = leadSite?.scores[lead.target];
  return (
    <div className="page"><div className="pagein">
      <div className="kicker">Findings</div>
      <h1>What a blind search of Earth's land surface turned up</h1>
      <p className="lede">Every one of {b.meta.grid.land_cells.toLocaleString()} land cells was scored against {b.targets.length} specific regions of the Moon and Mars using measured terrain, temperature, moisture, surface and atmosphere, then checked against independent geological maps. Nothing below was placed by hand: each site is where the numbers put it.</p>

      <div className="steps">
        <div className="step">
          <div className="label">1 · Proof</div>
          <div className="big">{env.top25}<span className="muted" style={{ fontSize: 16 }}> of {env.n}</span></div>
          <p>analog sites that the community chose for their <b>environment</b> fall in the top quarter of Earth's land in our ranking; {env.top10} are in the top tenth. Chance alone would put about {Math.round(env.n * 0.25)} there (p = {env.p.toExponential(0).replace("e-", " × 10⁻")}).</p>
        </div>
        <div className="step">
          <div className="label">2 · Surprise</div>
          <div className="big">{leadSc ? leadSc.matched.length : "—"}<span className="muted" style={{ fontSize: 16 }}> of {leadSc ? leadSc.expected.length : "—"}</span></div>
          <p>dimensions matched by a site that appears on no established analog list we could find: {leadSite ? [leadSite.name.split(" · ")[0], leadSite.name.split(" · ").slice(-1)[0]].join(", ") : "—"}, against {lead ? tname(b, lead.target) : "—"}.</p>
        </div>
        <div className="step">
          <div className="label">3 · Usefulness</div>
          <div className="big">{b.portfolio.n_covered}<span className="muted" style={{ fontSize: 16 }}> of {b.portfolio.n_requirements}</span></div>
          <p>region-by-dimension requirements are covered by a portfolio of {b.portfolio.chosen.length} complementary sites. The rest cannot be covered anywhere on Earth, and we say which.</p>
        </div>
      </div>

      {b.findings.map((f, i) => {
        const site = b.sites.find((s) => s.id === f.site), target = b.targets.find((t) => t.id === f.target);
        if (!site || !target || !site.scores[target.id]) return null;
        const sc = site.scores[target.id], ft = site.features!, cb = bodyColor(target.body), ex = reliefExag(site.window, target.window);
        const tv = (k: string) => target.features[k]?.value;
        return (
          <div className="card finding" key={f.id} data-body={target.body}>
            <div className="ftext">
              <div className="kicker" style={{ color: cb }}>Finding {i + 1} · {target.body === "mars" ? "Mars" : "Moon"} · {target.name}</div>
              <h3>{f.headline}</h3>
              <p className="prose">{f.summary}</p>
              <div className="evgrid">
                <div className="ev"><div className="label">Dimensions matched</div><div className="v">{sc.matched.length} of {sc.expected.length} <Pips expected={sc.expected} matched={sc.matched} have={(k) => sc.fac[k as FactorId] != null} /></div></div>
                <div className="ev"><div className="label">Earth rank (scan)</div><div className="v">top {(100 - (sc.pct.balanced ?? 0)).toFixed((sc.pct.balanced ?? 0) > 99 ? 2 : 1)}%</div></div>
                <div className="ev"><div className="label">Rank under stress</div><div className="v">{fmt(sc.conf.pct_p10, 1)}–{fmt(sc.conf.pct_p90, 1)}</div></div>
                <div className="ev"><div className="label">Confidence</div><div className="v"><span className={`conf ${sc.conf.label}`}>{sc.conf.label}</span></div></div>
                <div className="ev"><div className="label">Median slope</div><div className="v"><span className="e-c">{fmt(ft.slope_med, 2)}°</span> <span className="dim">vs</span> <span style={{ color: cb }}>{fmt(tv("slope_med"), 2)}°</span></div></div>
                <div className="ev"><div className="label">Relief</div><div className="v"><span className="e-c">{smart(ft.relief)}</span> <span className="dim">vs</span> <span style={{ color: cb }}>{smart(tv("relief"))} m</span></div></div>
                <div className="ev"><div className="label">Albedo</div><div className="v"><span className="e-c">{fmt(ft.albedo, 2)}</span> <span className="dim">vs</span> <span style={{ color: cb }}>{fmt(tv("albedo"), 2)}</span></div></div>
                <div className="ev"><div className="label">Mean temperature</div><div className="v"><span className="e-c">{fmt(ft.t_mean, 0)}</span> <span className="dim">vs</span> <span style={{ color: cb }}>{fmt(tv("t_mean"), 0)} K</span></div></div>
              </div>
              <div className="label" style={{ margin: "14px 0 7px" }}>Why the score is what it is</div>
              <ul className="plain">
                {sc.expected.filter((k) => sc.fac[k] != null).map((k) => <li key={k} className={sc.matched.includes(k) ? "plus" : "minus"}><b>{flabel(b, k)} {fmt(sc.fac[k], 2)}.</b> {describe(k, site, target, b)}</li>)}
              </ul>
              <div className="label" style={{ margin: "16px 0 7px" }}>Independent evidence</div>
              <ul className="plain">{f.literature.map((l, j) => <li key={j}>{l.claim} <span className="dim">— {l.url ? <a href={l.url} target="_blank" rel="noreferrer">{l.source}</a> : l.source}</span></li>)}</ul>
              <div className="label" style={{ margin: "16px 0 7px" }}>Important differences</div>
              <ul className="plain">{f.differences.map((d, j) => <li key={j} className="minus">{d}</li>)}</ul>
              <div className="callout info" style={{ marginTop: 16 }}><b>How new is this?</b> {f.novelty}</div>
              <p className="prose" style={{ marginTop: 14 }}><b>Why it matters.</b> {f.why}</p>
              <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn primary" onClick={() => openSite(site.id, target.id)}>Open full dossier →</button>
              </div>
            </div>
            <div className="fvis">
              <div className="twocol">
                <div><div className="frame">{b.imagery.sites[site.id] ? <img src={asset(`img/sites/${site.id}.jpg`)} alt={site.name} loading="lazy" /> : <Relief win={site.window} stepKm={b.meta.window.step_km} exag={ex} tint={TINT.earth} />}<div className="cap e">Earth</div><div className="scale" style={{ width: "32.9%" }}>20 km</div></div></div>
                <div><div className="frame"><img src={asset(`img/targets/${target.id}.jpg`)} alt={target.name} loading="lazy" /><div className={`cap ${target.body}`}>{target.body}</div><div className="scale" style={{ width: "32.9%" }}>20 km</div></div></div>
                <div><div className="frame"><Relief win={site.window} stepKm={b.meta.window.step_km} exag={ex} tint={TINT.earth} /><div className="cap e">Relief</div></div></div>
                <div><div className="frame"><Relief win={target.window} stepKm={b.meta.window.step_km} exag={ex} tint={TINT[target.body]} /><div className={`cap ${target.body}`}>Relief</div></div></div>
              </div>
              <p className="credit" style={{ marginTop: 8 }}><b style={{ color: "var(--text)" }}>{site.name}</b> · {fmtCoord(site.lat, site.lon)}<br />against <b style={{ color: "var(--text)" }}>{target.name}</b> · {fmtCoord(target.lat, target.lon)}<br />All four panels cover 61 km. Relief uses the same vertical exaggeration (×{ex}). {b.imagery.site_credit}. {b.imagery.targets[target.id]}.</p>
            </div>
          </div>
        );
      })}

      <h2>How the proof step was scored</h2>
      <p className="lede">Established analog sites were never shown to the scoring code. Afterwards we asked where each one landed. Sites picked for their environment should rank high; sites picked for a mineral, a crater or a nearby research station should not, because the scan cannot see those reasons.</p>
      <ValidationTable b={b} openSite={openSite} />
    </div></div>
  );
}

function ValidationTable({ b, openSite }: { b: Bundle; openSite: Open }) {
  const v = b.validation;
  const basis = (x: string[]) => x.map((k) => ({ env: "environment", geo: "geology", ops: "operations" } as any)[k]).join(" · ");
  return (
    <div className="card">
      <div className="pad" style={{ display: "flex", gap: 28, flexWrap: "wrap", borderBottom: "1px solid var(--line)" }}>
        {[{ k: "Chosen for environment", s: v.env.balanced }, { k: "Chosen for geology or operations only", s: v.other.balanced }].map((g) => (
          <div key={g.k}>
            <div className="label">{g.k} · n = {g.s.n}</div>
            <div className="num" style={{ fontSize: 22, marginTop: 3 }}>{fmt(g.s.mean_u, 2)} <span className="muted" style={{ fontSize: 12 }}>mean calibrated rank (chance = 0.50)</span></div>
            <div className="small muted">top 10% of land: {g.s.top10} · top 25%: {g.s.top25} · one-sided p = {g.s.p < 0.001 ? g.s.p.toExponential(1) : g.s.p.toFixed(3)}</div>
          </div>
        ))}
      </div>
      <div className="scroll-x">
        <table className="data">
          <thead><tr><th>Established analog</th><th>Chosen for</th><th>Best-matching region</th><th style={{ textAlign: "right" }}>Percentile</th><th style={{ width: "26%" }}>Calibrated rank (0 = worst land, 1 = best)</th></tr></thead>
          <tbody>
            {[...v.rows].sort((x, y) => y.u - x.u).map((r) => (
              <tr key={r.id} className="clk" onClick={() => openSite(r.id, r.best_target)}>
                <td>{r.name}</td><td className="muted">{basis(r.basis)}</td><td>{tname(b, r.best_target)}</td><td className="n">{r.best_pct.toFixed(1)}</td>
                <td><div className="bar" style={{ marginTop: 6 }}><i style={{ width: `${r.u * 100}%`, background: r.env ? "var(--earth)" : "#59626e" }} /><u style={{ left: "50%" }} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note pad" style={{ marginTop: 0 }}>{v.note} Teal bars are environment-motivated sites; grey bars were chosen for geology or logistics. The centre tick is where a random land location would sit on average.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ PORTFOLIO */
export function Portfolio({ b, openSite }: { b: Bundle; openSite: Open }) {
  const p = b.portfolio;
  const owner = new Map<string, number>();
  p.chosen.forEach((c, i) => c.gain.forEach(([t, k]) => owner.set(`${t}|${k}`, i)));
  const cols = b.meta.factors.map((f) => f.id);
  const letters = "ABCDEFGH";
  const colors = ["#63c7b2", "#e0793f", "#a9bfd9", "#e3b55a", "#b693d6", "#7fd1a0"];
  const uncovered = p.requirements.filter(([t, k]) => !owner.has(`${t}|${k}`));
  const byFactor = cols.map((k) => ({ k, n: uncovered.filter((r) => r[1] === k).length, tot: p.requirements.filter((r) => r[1] === k).length }));
  return (
    <div className="page"><div className="pagein">
      <div className="kicker">Analog portfolio</div>
      <h1>No single place is enough. Which few, together, cover the most?</h1>
      <p className="lede">A requirement is one dimension of one reference region, for example “terrain like Gale Crater”. A site covers it when its score for that dimension reaches {p.threshold}. Sites are added greedily: each pick is the one that covers the most requirements still open (a standard set-cover heuristic). {p.n_covered} of {p.n_requirements} requirements end up covered.</p>

      <div className="grid2" style={{ marginTop: 22 }}>
        {p.chosen.map((c, i) => {
          const s = b.sites.find((x) => x.id === c.id)!;
          const groups = new Map<string, string[]>();
          c.gain.forEach(([t, k]) => groups.set(k, [...(groups.get(k) ?? []), tname(b, t)]));
          return (
            <div className="card pad" key={c.id}>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                <span className="num" style={{ color: "#0b0d10", background: colors[i], padding: "1px 7px", borderRadius: 2, fontWeight: 600 }}>{letters[i]}</span>
                <h3 className="serif" style={{ fontSize: 19 }}>{c.name}</h3>
              </div>
              <div className="small muted num" style={{ margin: "4px 0 10px" }}>{fmtCoord(s.lat, s.lon)} · <span className={`tag ${s.kind === "known" ? "known" : "cand"}`}>{s.kind === "known" ? "established" : "candidate"}</span> · adds {c.gain.length} · covers {c.total} in total</div>
              <ul className="plain">{[...groups.entries()].map(([k, ts]) => <li key={k} className="plus"><b>{flabel(b, k)}</b> for {ts.join(", ")}</li>)}</ul>
              <button className="chip" style={{ marginTop: 12 }} onClick={() => openSite(c.id, c.gain[0][0])}>Open dossier →</button>
            </div>
          );
        })}
      </div>

      <h2>Coverage matrix</h2>
      <p className="lede">Each cell is one requirement. A letter means the portfolio covers it and which site does. A bare number is the best score any of the {b.sites.length} listed sites reaches, below the threshold.</p>
      <div className="card pad scroll-x">
        <table className="matrix">
          <thead><tr><th></th>{cols.map((k) => <th key={k} className="col">{flabel(b, k)}</th>)}</tr></thead>
          <tbody>
            {b.targets.map((t) => (
              <tr key={t.id}>
                <th><span style={{ color: bodyColor(t.body) }}>●</span> {t.name}</th>
                {cols.map((k) => {
                  const key = `${t.id}|${k}`, best = p.best[key];
                  if (!best) return <td key={k} className="na" title="Not applicable to this region">·</td>;
                  const o = owner.get(key);
                  return o != null
                    ? <td key={k} className="cov" style={{ background: colors[o] }} title={`${p.chosen[o].name}`}>{letters[o]}</td>
                    : <td key={k} title={`Best available: ${best.name}`} style={{ background: `color-mix(in srgb, ${rampCss(t.body, 0.55)} ${Math.round(best.score * 55)}%, #14181d)`, color: "#aab1bb" }}>{fmt(best.score, 2)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Where the portfolio falls short</h2>
      <div className="grid2">
        <div className="card pad">
          <div className="label" style={{ marginBottom: 10 }}>Uncovered requirements by dimension</div>
          {byFactor.filter((x) => x.tot > 0).map((x) => (
            <div className="fachead" key={x.k} style={{ marginBottom: 9 }}>
              <span className="fn">{flabel(b, x.k)}</span>
              <div className="bar"><i style={{ width: `${(1 - x.n / x.tot) * 100}%`, background: "var(--earth)" }} /></div>
              <span className="v">{x.tot - x.n}/{x.tot}</span>
            </div>
          ))}
          <p className="note">Thermal and atmosphere stay almost entirely open. That is a property of Earth, not of the search: the best cells on the planet still sit far from lunar and Martian values.</p>
        </div>
        <div className="card pad">
          <div className="label" style={{ marginBottom: 10 }}>What no field site can supply</div>
          <ul className="plain">{b.meta.limitations.slice(0, 5).map((l) => <li key={l.title}><b>{l.title}.</b> {l.body}</li>)}</ul>
        </div>
      </div>
    </div></div>
  );
}

/* ------------------------------------------------------------------ METHOD */
export function Method({ b, openSite }: { b: Bundle; openSite: Open }) {
  const m = b.meta;
  const methodText: Record<string, string> = { distribution: "Distribution match", direct: "Direct match", direct_log: "Direct match (log)", gap: "Gap closure", gap_log: "Gap closure (log)", proxy_cryo: "Proxy", proxy_frozen: "Proxy" };
  const anchor = (f: any) => {
    const r = m.earth_ref[f.id];
    if (!r) return "—";
    if (f.method === "gap") return `Earth median ${smart(r.median)} ${f.unit}`;
    if (f.method === "gap_log") return `Earth median ${smart(Math.pow(10, r.median))} ${f.unit}`;
    if (f.method === "direct") return `τ = ${smart(m.params.tol_k * r.sigma)} ${f.unit}`;
    if (f.method === "direct_log" || f.method === "distribution") return `τ = ×${Math.pow(10, m.params.tol_k * r.sigma).toFixed(2)}`;
    return f.id === "cryo" ? "logistic at 271 K" : "months below 273 K";
  };
  return (
    <div className="page"><div className="pagein">
      <div className="kicker">Method &amp; data</div>
      <h1>How a similarity score is made, and how far to trust it</h1>
      <p className="lede">The scoring code is short and public (<span className="num">pipeline/score.py</span>). Everything on this page is generated from the same run that produced the map: {m.generated}, {m.grid.land_cells.toLocaleString()} land cells at {m.grid.deg}°, {m.counts.targets} reference regions, {m.counts.sites} sites in the detailed tier.</p>

      <h2>1 · Same measurement on three worlds</h2>
      <p className="lede">Terrain is sampled identically everywhere: a {m.window.n} × {m.window.n} window at {m.window.step_km} km spacing ({m.window.size_km.toFixed(0)} km across) on a local equal-distance grid. The three global elevation models were chosen because their pixels are almost the same size on the ground: ETOPO 1.85 km, MOLA 1.85 km, LOLA 1.90 km. Climate and surface variables come from the datasets listed at the bottom, each tagged as measured, modelled or proxy.</p>

      <h2>2 · The comparison depends on the variable</h2>
      <div className="grid3">
        <div className="card pad"><div className="label">Direct match</div><p className="prose" style={{ margin: "8px 0" }}>For quantities Earth can actually reach: slopes, relief, albedo, dust loading.</p><div className="formula">{"s = 0.5 ^ ( |x − x★| / τ )\nτ = " + m.params.tol_k + " × spread over Earth's land"}</div><p className="note">Similarity halves for every τ of mismatch. τ is set by how much the variable varies across Earth, not by hand.</p></div>
        <div className="card pad"><div className="label">Gap closure</div><p className="prose" style={{ margin: "8px 0" }}>For quantities no place on Earth reaches: temperature, dryness, pressure.</p><div className="formula">{"s = (x − x⊕) / (x★ − x⊕)\nx⊕ = median of Earth's land"}</div><p className="note">1 means the site reaches the planetary value, 0 means it is no closer than ordinary land. A distance metric would read ~0 everywhere and hide real differences.</p></div>
        <div className="card pad"><div className="label">Category affinity</div><p className="prose" style={{ margin: "8px 0" }}>For rock type, from independent geological maps, at listed sites only.</p><div className="formula">{"s = mean over documented lithologies\n    of best affinity mapped at site"}</div><p className="note">Basalt for basalt scores 1; gabbro for basalt 0.6; any other exposed rock 0.15. Impact structures and lava tubes are not on maps and are not scored.</p></div>
      </div>
      <div className="card scroll-x" style={{ marginTop: 16 }}>
        <table className="data">
          <thead><tr><th>Dimension</th><th>Variable</th><th>Method</th><th>Anchor / tolerance</th><th>Earth data</th></tr></thead>
          <tbody>{m.features.map((f) => (
            <tr key={f.id}><td>{flabel(b, f.factor)}</td><td>{f.label}{f.unit ? <span className="dim"> ({f.unit === "deg" ? "°" : f.unit})</span> : null}</td><td className="muted">{methodText[f.method]}</td><td className="num small">{anchor(f)}</td><td><span className={`tag ${f.earth_kind}`}>{f.earth_kind}</span></td></tr>
          ))}</tbody>
        </table>
      </div>

      <h2>3 · Combining, and keeping confidence separate</h2>
      <div className="grid2">
        <div className="card pad"><div className="label">Similarity</div><div className="formula" style={{ margin: "8px 0" }}>{"dimension = geometric mean of its variables\noverall   = exp( Σ wᵢ · ln max(sᵢ, " + m.params.floor + ") / Σ wᵢ )"}</div><p className="note">Geometric means are deliberate: an ice sheet is bare but not rock-coloured, and a hot desert is dry but not cold. Neither should be able to average its way to a high score. Weights are the mission profile and are adjustable on the Explore page. A dimension counts as matched at {m.params.match_threshold}.</p></div>
        <div className="card pad"><div className="label">Confidence = coverage × evidence quality × rank stability</div><ul className="plain" style={{ marginTop: 8 }}>
          <li><b>Coverage</b>: share of the profile's weight backed by data at that site.</li>
          <li><b>Evidence quality</b>: the weaker of the Earth and planetary data kinds per variable ({Object.entries(m.evidence_grade).map(([k, v]) => `${k} ${v}`).join(", ")}).</li>
          <li><b>Rank stability</b>: how little the site's percentile moves across {m.sensitivity.runs} perturbed runs.</li>
        </ul><p className="note">High ≥ 0.55, moderate ≥ 0.35. Confidence never changes the similarity number.</p></div>
      </div>

      <h2>4 · Sensitivity</h2>
      <p className="lede">{m.sensitivity.description} The table gives the rank correlation between each perturbed global ranking and the baseline.</p>
      <div className="card scroll-x">
        <table className="data"><thead><tr><th>Reference region</th><th>Body</th><th style={{ textAlign: "right" }}>Mean rank correlation</th><th style={{ textAlign: "right" }}>Worst run</th><th style={{ width: "30%" }}></th></tr></thead>
          <tbody>{b.targets.map((t) => (
            <tr key={t.id}><td>{t.name}</td><td className="muted">{t.body}</td><td className="n">{fmt(t.sensitivity.rho_mean, 3)}</td><td className="n">{fmt(t.sensitivity.rho_min, 3)}</td>
              <td><div className="bar" style={{ marginTop: 6 }}><i style={{ width: `${t.sensitivity.rho_mean * 100}%`, background: bodyColor(t.body) }} /></div></td></tr>
          ))}</tbody></table>
      </div>
      <p className="note">Global rankings are stable on average, but single runs that drop a dimension can reshuffle them substantially. That is why every site carries its own stability figure.</p>

      <h2>5 · Validation against established analogs</h2>
      <p className="lede">See the Findings page for the reasoning. The table is repeated here so the method can be judged on one screen.</p>
      <ValidationTable b={b} openSite={openSite} />

      <h2>6 · Datasets and provenance</h2>
      <p className="lede">All sources are public and need no login. Open a row for resolution, coverage, format and limits.</p>
      <div className="card">
        {m.datasets.map((d) => (
          <details className="ds" key={d.id}>
            <summary><span className={`tag ${d.kind === "measured" ? "measured" : d.kind === "model" ? "model" : ""}`}>{d.kind}</span><span><b>{d.name}</b><br /><span className="small muted">{d.agency} · {d.used_for}</span></span><span className="label">{d.body}</span></summary>
            <dl className="body">
              <dt>Measures</dt><dd>{d.measures}</dd><dt>Resolution</dt><dd>{d.resolution}</dd><dt>Time span</dt><dd>{d.temporal}</dd><dt>Coverage</dt><dd>{d.coverage}</dd>
              <dt>Format</dt><dd>{d.format}</dd><dt>Limits</dt><dd>{d.limits}</dd><dt>Citation</dt><dd>{d.citation}</dd><dt>Access</dt><dd><a href={d.url} target="_blank" rel="noreferrer">{d.url}</a></dd>
            </dl>
          </details>
        ))}
      </div>

      <h2>7 · Limits of this work</h2>
      <div className="grid2">{m.limitations.map((l) => <div className="card pad" key={l.title}><b>{l.title}</b><p className="prose" style={{ marginTop: 6 }}>{l.body}</p></div>)}</div>
    </div></div>
  );
}
