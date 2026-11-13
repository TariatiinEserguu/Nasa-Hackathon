import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Site } from "../lib/data";
import { ramp } from "../lib/score";

const MAXLAT = 85.0511;
const CORNERS: [[number, number], [number, number], [number, number], [number, number]] = [[-180, MAXLAT], [180, MAXLAT], [180, -MAXLAT], [-180, -MAXLAT]];
const BLANK = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

/** Paint the 0.25° score grid into a Web-Mercator canvas (rows resampled by latitude). */
function renderHeat(grid: Float32Array, w: number, h: number, rampName: string, lo: number, hi: number) {
  const H = 1440;
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = H;
  const ctx = cv.getContext("2d")!;
  const img = ctx.createImageData(w, H);
  const lut = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255, [r, g, b] = ramp(rampName, t);
    lut[i * 4] = r; lut[i * 4 + 1] = g; lut[i * 4 + 2] = b; lut[i * 4 + 3] = 255 * (0.42 + 0.58 * t);
  }
  const span = hi - lo || 1;
  for (let y = 0; y < H; y++) {
    const my = Math.PI * (1 - (2 * (y + 0.5)) / H);
    const lat = (Math.atan(Math.sinh(my)) * 180) / Math.PI;
    const sr = Math.min(h - 1, Math.max(0, Math.floor((90 - lat) / (180 / h))));
    for (let x = 0; x < w; x++) {
      const v = grid[sr * w + x];
      if (v !== v || v < lo) continue;
      const k = Math.min(255, Math.floor(((v - lo) / span) * 255)) * 4, o = (y * w + x) * 4;
      img.data[o] = lut[k]; img.data[o + 1] = lut[k + 1]; img.data[o + 2] = lut[k + 2]; img.data[o + 3] = lut[k + 3];
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv.toDataURL("image/png");
}

export interface MapSite { site: Site; score: number; rank: number | null }

interface Props {
  grid: Float32Array | null; w: number; h: number; rampName: string; domain: [number, number];
  sites: MapSite[]; selected: string | null; onSelect: (id: string | null) => void; showOverlay: boolean;
}

export function MapView({ grid, w, h, rampName, domain, sites, selected, onSelect, showOverlay }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ready = useRef(false);
  const markers = useRef<maplibregl.Marker[]>([]);
  const latest = useRef<Props>({ grid, w, h, rampName, domain, sites, selected, onSelect, showOverlay });
  latest.current = { grid, w, h, rampName, domain, sites, selected, onSelect, showOverlay };

  const syncHeat = () => {
    const m = map.current, p = latest.current;
    if (!m || !ready.current) return;
    const src = m.getSource("heat") as maplibregl.ImageSource | undefined;
    if (!src) return;
    src.updateImage({ url: p.grid && p.showOverlay ? renderHeat(p.grid, p.w, p.h, p.rampName, p.domain[0], p.domain[1]) : BLANK, coordinates: CORNERS });
  };
  const syncSites = () => {
    const m = map.current, p = latest.current;
    if (!m || !ready.current) return;
    (m.getSource("sites") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: p.sites.map(({ site, score, rank }) => ({
        type: "Feature", geometry: { type: "Point", coordinates: [site.lon, site.lat] },
        properties: { id: site.id, name: site.name, kind: site.kind, score: Number.isFinite(score) ? score : 0, rank: rank ?? 999, sel: site.id === p.selected ? 1 : 0 },
      })),
    });
    markers.current.forEach((k) => k.remove());
    markers.current = p.sites.filter((s) => s.rank != null && s.rank <= 8).map(({ site, rank }) => {
      const d = document.createElement("div");
      d.className = `mk ${site.kind === "known" ? "known" : ""} ${site.id === p.selected ? "sel" : ""}`;
      d.textContent = String(rank);
      d.title = site.name;
      d.onclick = (e) => { e.stopPropagation(); latest.current.onSelect(site.id); };
      return new maplibregl.Marker({ element: d }).setLngLat([site.lon, site.lat]).addTo(m);
    });
  };

  useEffect(() => {
    const m = new maplibregl.Map({
      container: el.current!, center: [72, 30], zoom: 2.05, minZoom: 0.6, maxZoom: 12, attributionControl: false,
      style: {
        version: 8,
        projection: { type: "globe" },
        sources: {
          base: {
            type: "raster", tileSize: 256, maxzoom: 13,
            tiles: ["https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg"],
            attribution: 'Imagery: <a href="https://s2maps.eu" target="_blank" rel="noreferrer">Sentinel-2 cloudless 2020</a> by EOX — contains modified Copernicus Sentinel data',
          },
        },
        layers: [
          { id: "bg", type: "background", paint: { "background-color": "#05070a" } },
          { id: "base", type: "raster", source: "base", paint: { "raster-saturation": -0.45, "raster-brightness-max": 0.72, "raster-contrast": 0.08 } },
        ],
        sky: { "atmosphere-blend": 0.35 },
      } as any,
    });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
    m.on("load", () => {
      m.addSource("heat", { type: "image", url: BLANK, coordinates: CORNERS });
      m.addLayer({ id: "heat", type: "raster", source: "heat", paint: { "raster-opacity": 0.86, "raster-resampling": "nearest", "raster-fade-duration": 0 } });
      m.addSource("sites", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "sel", type: "circle", source: "sites", filter: ["==", ["get", "sel"], 1], paint: { "circle-radius": 13, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.5 } });
      m.addLayer({ id: "cand", type: "circle", source: "sites", filter: ["==", ["get", "kind"], "candidate"], paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 3.2, 6, 6], "circle-color": "#63c7b2", "circle-stroke-color": "#06110f", "circle-stroke-width": 1.2 } });
      m.addLayer({ id: "known", type: "circle", source: "sites", filter: ["==", ["get", "kind"], "known"], paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 3.6, 6, 6.5], "circle-color": "rgba(10,12,15,0.55)", "circle-stroke-color": "#f1eee8", "circle-stroke-width": 1.8 } });
      for (const layer of ["cand", "known"]) {
        m.on("click", layer, (e) => { const f = e.features?.[0]; if (f) latest.current.onSelect(String(f.properties.id)); });
        m.on("mouseenter", layer, (e) => {
          m.getCanvas().style.cursor = "pointer";
          const f = e.features?.[0];
          if (!f) return;
          const p = f.properties as any;
          popup.setLngLat((f.geometry as any).coordinates).setHTML(
            `<div style="font-weight:600">${p.name}</div><div style="color:#949aa3;font-family:IBM Plex Mono,monospace;font-size:11px">${p.kind === "known" ? "established analog" : "scan candidate"} · similarity ${Number(p.score).toFixed(2)}</div>`).addTo(m);
        });
        m.on("mouseleave", layer, () => { m.getCanvas().style.cursor = ""; popup.remove(); });
      }
      ready.current = true;
      (window as any).__ptMap = m; // handle for automated UI tests
      syncHeat(); syncSites();
    });
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(el.current!);
    return () => { ro.disconnect(); m.remove(); map.current = null; ready.current = false; };
  }, []);

  useEffect(syncHeat, [grid, rampName, domain[0], domain[1], showOverlay]);
  useEffect(syncSites, [sites, selected]);
  useEffect(() => {
    const m = map.current;
    const s = sites.find((x) => x.site.id === selected)?.site;
    if (m && s) m.flyTo({ center: [s.lon, Math.max(-84, Math.min(84, s.lat))], zoom: Math.max(m.getZoom(), 5.2), speed: 1.4, essential: false });
  }, [selected]);

  return <div ref={el} className="map" />;
}
