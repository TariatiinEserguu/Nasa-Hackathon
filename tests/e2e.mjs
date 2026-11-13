// End-to-end UI checks against a running build.
//   cd web && npm run build && npx vite preview --port 4173 &
//   cd tests && npm i playwright && npx playwright install chromium-headless-shell && node e2e.mjs
// Verifies that the map initialises, client-side scores equal the Python pipeline's,
// profiles / sliders / filters / layers work, dossiers and deep links open, and missing data degrades cleanly.
const BASE = process.env.BASE_URL ?? "http://localhost:4173";
import { chromium } from "playwright";
import fs from "fs";
const sites = JSON.parse(fs.readFileSync("../web/public/data/sites.json", "utf8")).filter((s) => s.features);
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => errors.push("PAGEERROR " + String(e).slice(0, 300)));
const ok = (name, cond, extra = "") => console.log(cond ? "PASS" : "FAIL", name, extra);
await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await page.waitForSelector(".rk", { timeout: 30000 });
await page.waitForFunction(() => window.__ptMap && window.__ptMap.getSource("heat"), null, { timeout: 30000 });
ok("map initialised with heat + sites sources", await page.evaluate(() => !!window.__ptMap.getSource("sites")));
// 1. ranking numbers equal the pipeline's own balanced overall (client aggregation == Python aggregation)
const top = await page.$$eval(".rk", (els) => els.slice(0, 5).map((e) => [e.querySelector(".nm").textContent, e.querySelector(".sc").textContent]));
const py = sites.map((s) => [s.name, s.scores.jezero.overall.balanced]).sort((a, b) => b[1] - a[1]).slice(0, 5);
ok("client ranking == pipeline ranking (Jezero, balanced)", top.every((t, i) => t[0] === py[i][0] && Math.abs(+t[1] - py[i][1]) < 0.006), JSON.stringify(top[0]) + " vs " + JSON.stringify(py[0]));
// 2. heat overlay actually painted
await page.waitForTimeout(3500);
const heat = await page.evaluate(() => { const s = window.__ptMap.getSource("heat"); return s && s.url ? s.url.length : -1; });
ok("heat overlay image rendered", heat > 20000, "dataURL bytes=" + heat);
const nfeat = await page.evaluate(() => window.__ptMap.querySourceFeatures("sites").length);
ok("site markers on map", nfeat > 20, "features in view=" + nfeat);
// 3. switch body -> Moon
await page.click('.bodyswitch button[data-b="moon"]');
await page.waitForTimeout(2500);
ok("moon mode lists lunar regions", (await page.$$eval(".titem .n", (e) => e.map((x) => x.textContent))).includes("Mare Tranquillitatis"));
await page.click('.titem:has-text("Mare Tranquillitatis")');
await page.waitForTimeout(2500);
const first = await page.$eval(".rk .nm", (e) => e.textContent);
ok("Mare Tranquillitatis top site is Harrat Khaybar", /Harrat Khaybar/.test(first), first);
// 4. profile preset + slider change re-rank
const before = await page.$$eval(".rk .sc", (e) => e.slice(0, 3).map((x) => x.textContent).join(","));
await page.click('.chip:has-text("Rover mobility")');
await page.waitForTimeout(1500);
const after = await page.$$eval(".rk .sc", (e) => e.slice(0, 3).map((x) => x.textContent).join(","));
ok("mission profile changes scores", before !== after, before + " -> " + after);
await page.locator('input[aria-label="Thermal weight"]').fill("4");
await page.waitForTimeout(1500);
const after2 = await page.$$eval(".rk .sc", (e) => e.slice(0, 3).map((x) => x.textContent).join(","));
ok("weight slider re-ranks live", after2 !== after, after + " -> " + after2);
// 5. factor layer
await page.click('.segs button:has-text("Terrain")');
await page.waitForTimeout(1500);
ok("factor layer selectable", (await page.$eval(".legendticks", (e) => e.textContent)).includes("terrain"));
// 6. filters
await page.click('.chip:has-text("Established")');
await page.waitForTimeout(600);
ok("filter: established only", (await page.$$eval(".rk .tag", (e) => e.map((x) => x.textContent))).every((t) => t === "established"));
await page.click('.filters .chip:has-text("All")');
await page.click('.chip:has-text("Balanced")');
// 7. open dossier from ranking
await page.click(".rk >> nth=0");
await page.waitForSelector(".dhead h2");
await page.waitForTimeout(2500);
ok("dossier opens", /Harrat Khaybar/.test(await page.$eval(".dhead h2", (e) => e.textContent)));
ok("dossier images load", await page.$$eval(".dsec .frame img", (els) => els.length >= 2 && els.every((i) => i.complete && i.naturalWidth > 100)));
ok("dossier charts drawn", (await page.$$("svg.chart")).length >= 3 && (await page.$$(".frame canvas")).length >= 3);
ok("url carries state", page.url().includes("t=tranquillitatis") && page.url().includes("s="), page.url());
await page.click('.tabs2 button:has-text("Relief")');
ok("relief toggle", (await page.$$(".twocol .frame canvas")).length === 2);
// 8. map click selects a site
await page.click(".back");
await page.waitForTimeout(500);
const pt = await page.evaluate(() => { const m = window.__ptMap; const f = m.queryRenderedFeatures({ layers: ["known", "cand"] })[0]; if (!f) return null; const p = m.project(f.geometry.coordinates); const r = m.getCanvas().getBoundingClientRect(); return { x: r.left + p.x, y: r.top + p.y, id: f.properties.id }; });
if (pt) { await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(1200); ok("clicking a map marker opens its dossier", page.url().includes("s="), pt.id + " " + page.url().split("?")[1]); } else ok("clicking a map marker opens its dossier", false, "no rendered feature");
// 9. other pages
for (const [tab, sel, min] of [["Findings", ".finding", 3], ["Portfolio", ".matrix td.cov", 20], ["Method & data", "details.ds", 12]]) {
  await page.click(`.nav button:has-text("${tab}")`);
  await page.waitForTimeout(1200);
  const n = (await page.$$(sel)).length;
  ok(`${tab} page renders`, n >= min, `${sel} x${n}`);
}
await page.click('.nav button:has-text("Findings")');
await page.click('.finding >> nth=1 >> .btn.primary');
await page.waitForSelector(".dhead h2");
ok("finding -> dossier deep link", /West Kunlun/.test(await page.$eval(".dhead h2", (e) => e.textContent)) && page.url().includes("t=jezero"));
// 10. missing-data behaviour: a site with no imagery / no geology still renders
const noGeo = sites.find((s) => !s.geology || !s.geology.units.length) || sites.find((s) => s.scores.jezero.fac.geology == null);
if (noGeo) { await page.goto(`${BASE}/#/explore?t=jezero&s=${noGeo.id}`); await page.reload(); await page.waitForSelector(".dhead h2"); ok("site without geology renders (n/a shown)", (await page.content()).includes("n/a") || (await page.content()).includes("no mapped unit"), noGeo.name); }
await page.goto(BASE + "/#/explore?t=jezero&s=does-not-exist"); await page.reload(); await page.waitForSelector(".rk");
ok("unknown site id falls back to ranking", true);
console.log("console/page errors:", errors.filter((e) => !/Failed to load resource|net::ERR/.test(e)).length ? errors : "none");
await browser.close();
