# PLANETARY TWIN — FIELD ATLAS

The design system of the web application, as implemented in `web/src/styles.css` and the components
under `web/src/components`. If this file and the code disagree, the code is wrong or this file is out
of date: fix whichever it is.

## 1. Identity

Planetary Twin is a geological atlas that happens to be interactive. The models are survey map sheets,
field reports and plate atlases: paper ground, ink line work, a title block on every map, a legend made
of boxes, coordinates in the margin, and notes that say how far a statement can be trusted.

Four rules give the atlas its character. Everything else follows from them.

1. **Colour is reserved for two things.** The three bodies (Earth, Mars, Moon) and the similarity
   layer. Nothing else on a page is coloured.
2. **Confidence is drawn in ink, never in colour.** A solid mark is high confidence, a half-filled mark
   moderate, an open mark low. Because similarity owns colour and confidence owns ink fill, the two
   cannot be confused on a map, in a list or in a tooltip.
3. **How a number was obtained is drawn as a pattern.** Solid means measured, hatched means model or
   blend, dotted means proxy. The same three patterns appear on tags, on score bars and on chart lines
   (model curves are dashed).
4. **Every map says what it is.** Title block, legend with numeric ranges, scale bar, credit line, and
   for outside layers the product, resolution, limits and whether the same product is scored.

Things the atlas does not use: gradients as decoration, shadows, rounded cards, glass effects, icon
tiles, emoji, uppercase tracked labels, entrance animations.

## 2. Colour

| Token | Hex | Use |
|---|---|---|
| `--paper` | `#F1EFE8` | Page ground (Warm Mineral Paper) |
| `--paper-2` | `#E9E6DC` | Selected rows, formula blocks, open layer details |
| `--paper-3` | `#E0DCCF` | Bar tracks, covered matrix cells, hover on buttons |
| `--sediment` | `#D8D2C4` | Hatch lines in "model" tags (Pale Sediment) |
| `--rule` | `#CDC7B8` | Hairline dividers inside a block |
| `--rule-strong` | `#B3AD9D` | Dividers between blocks, control borders at rest |
| `--ink` | `#202622` | Text, line work, map frames, solid marks (Deep Geological Ink) |
| `--charcoal` | `#292D2A` | Tooltips and the ground behind Moon and Mars maps (Volcanic Charcoal) |
| `--ink-2` | `#3D443E` | Secondary text |
| `--note` | `#5F6359` | Annotation text, 5.4:1 on paper |
| `--faint` | `#777A70` | Technical Annotation: ticks, dashed outlines, large marks only |
| `--mars` / `--mars-ink` | `#B66B48` / `#8F4B2C` | Mars: fills / text (Oxidized Copper) |
| `--moon` / `--moon-ink` | `#55697C` / `#3D5063` | Moon: fills / text (mare slate, added to the starting palette) |
| `--earth` / `--earth-ink` | `#858D70` / `#56603F` | Earth: fills / text (Muted Lichen) |
| `--sea` | `#D2D8D3` | Water on every map |
| `--land` | `#EFEDE5` | Land on SVG maps and at sea level on the relief basemap |

`--accent` and `--accent-ink` point at Mars or Moon, set by `data-body` on the app root, so one switch
re-colours every accent on the page.

### Similarity ramps

Each body has two ramps, both ordered in lightness so they survive greyscale printing and colour-blind
viewing (`web/src/lib/score.ts`).

| Ramp | Direction | Used on |
|---|---|---|
| `marsInk` | pale sand → copper → oxblood | paper relief basemap |
| `moonInk` | pale blue-grey → slate blue → deep indigo | paper relief basemap |
| `mars` | deep plum → orange → pale yellow | dark imagery basemaps |
| `moon` | deep navy → teal → pale green | dark imagery basemaps |

On paper the strongest match is the deepest ink; on dark imagery it is the brightest. The legend always
shows the ramp in use.

The layer shows only the best-scoring 30% of land, in five classes by share of land area: top 30–10%,
10–3%, 3–1%, 1–0.1%, top 0.1%. Class limits are recomputed from the live distribution whenever the
region, dimension or weights change, and the legend prints the score range of each class. A continuous
style is available. Classes are a display choice only; they never touch a score or a rank.

## 3. Typography

Three families, loaded from Google Fonts in `web/index.html`.

| Family | Role |
|---|---|
| **Newsreader** (serif, optical sizes) | Headings, site and region names, long-form prose, the title block, italic notes and place-name labels on maps |
| **IBM Plex Sans** | Controls, tables, annotation, short interface text |
| **IBM Plex Mono** | Coordinates, measurements, scores and dates only |

| Element | Size / line height | Notes |
|---|---|---|
| Page title | 32–54 px / 1.03, weight 500 | `clamp`, balanced wrap, max 20 characters per line |
| Section heading | 28 px / 1.15 | |
| Report title (site name) | 28–40 px / 1.04 | scales with the report column |
| Report section heading | 20 px / 1.2 | |
| Panel heading | 17 px / 1.2 | phrased as the question the control answers |
| Lede | 18 px / 1.48 serif | max 68 characters |
| Prose | 16 px / 1.5 serif | max 66 characters |
| Interface text | 14 px / 1.45 sans | |
| Annotation | 12.5 px, `--note` | |
| Fine print and credits | 11.5 px | |

Labels are sentence case. Mono is never used for words. Italic serif marks a remark from the atlas
itself: the kind of page, the "where Earth resembles" line, map notes.

## 4. Space and layout

- Base gap 16 px; report and page gutters 20 and 32 px. Blocks are separated by rules, not by boxes.
- Corners are square. Controls carry a 2 px radius; nothing else is rounded.
- No shadows. The masthead has a double rule (ink, gap, grey), the mark of a sheet header.
- Each section has its own composition:

| Section | Composition |
|---|---|
| Explore | Three columns: question rail, map sheet with a neat line, ranked list or field report |
| Field report | One reading column: header ledger, then sections divided by rules |
| Findings | Editorial: three large figures across, then articles with a sticky figure column |
| Portfolio | A framed world plate, a roster, then the matrix |
| Method & data | A document: sticky numbered contents beside a single text column |

## 5. Navigation

- Masthead: wordmark, the four sections, and the body switch ("Compare Earth with Mars / Moon").
  The current section carries a 3 px ink bar that sits on the masthead rule.
- Routes are hash routes and are kept from the original application: `#/explore?t=<region>&s=<site>`,
  `#/findings`, `#/portfolio`, `#/method`. Explore also writes `l` (dimension), `b` (basemap) and
  `o` (observation overlay) when they differ from the defaults, so a view can be shared.
- Tabs inside a column (Question / Map layers, Ranked sites / Reference region) use the same ink bar.

## 6. Controls

| Control | Rule |
|---|---|
| Button | 1 px ink border, paper fill; primary is ink fill with paper text and a body-colour underline on hover |
| Chip | 1 px grey border; selected is ink fill. Used for presets and filters |
| Segmented control | One ink border around the group; selected segment is ink fill. Used for either/or choices on maps |
| Range slider | Native, ink accent, with the value in mono beside it |
| Radio / checkbox rows | Native inputs with a name, one sentence of purpose and a source line. An open row turns `--paper-2` and shows its facts |
| Date control | Previous, native date field, next; steps by the layer's own period (day, month, year) and stops at the latest date the service is expected to hold |
| Text field (go to coordinates) | Mono, no box inside the frame; an error is stated in words above the field |

Button text says what will happen ("Open the field report for Harrat Khaybar", "Search the Copernicus
catalogue"). There are no arrow glyphs on buttons.

## 7. Tables

- `table.data`: full-width, ink rule under the header, hairlines between rows, numbers in mono and
  right-aligned. Rows that open a report highlight on hover and respond to Enter.
- `table.ledger`: the same, inside reports, with a caption that states what the table is.
- `table.matrix`: the coverage matrix. A covered requirement shows the site letter on `--paper-3`; an
  open one shows the best available score with a thin bar. Pointing at a site turns its cells to ink.
- Position on a 0–1 scale is drawn as a mark on a strip with reference ticks, not as a filled bar, so a
  low value is as visible as a high one.

## 8. Charts

Hand-drawn SVG in `web/src/components/charts.tsx`.

- Axis text in mono 10 px, grid lines in `--rule`, no chart borders.
- Earth is always lichen, the planetary body copper or slate. Line weight 1.6 px.
- Model curves (Mars Climate Database) are dashed; measured curves (Diviner) are solid.
- Shaded relief panels are drawn from the same 32 × 32 elevation window the terrain score uses, with a
  shared vertical exaggeration and light direction on both sides of a comparison.
- Score bars: body colour, with an ink tick at the match threshold. Per-variable bars take the pattern
  of their weakest evidence kind.
- Confidence meters are ink.

## 9. Maps

### Frames and furniture

Every interactive map sits in a 1 px ink frame; the main map adds an inner neat line. Furniture, all in
paper boxes with ink borders:

- **Title block** (top left): "Where Earth resembles", the region, its coordinates, the dimension and
  weight profile in force.
- **Dimension selector** beside it.
- **View controls** (top right): zoom in, zoom out, reset, globe / flat.
- **Legend** (bottom left): class boxes with score ranges, a histogram of land area by score, the
  official legend of any observation overlay, and the key to site symbols.
- **Scale bar** (bottom right): a round distance measured at the map centre. On Moon and Mars maps it
  is computed with that body's radius.
- **Go to** field for coordinates.
- **Readout strip** under the map: coordinates under the cursor, the cell's score, its percentile and
  every dimension score. A click pins the cell.
- **Credit line** under the map, rebuilt from the layers that are on.

### The relief basemap

"Atlas relief" is drawn in the browser from open elevation tiles: a hypsometric tint in sediment tones
(steps at 0, 500, 1500, 3000, 4500, 6000 m) under grey hill shading lit from the north-west. Sea is one
flat tone. Coastlines and graticule are ink at reduced opacity; country boundaries are dashed.

### Site symbols

| Shape | Meaning | Fill | Meaning |
|---|---|---|---|
| Circle | candidate from the scan | solid | high confidence |
| Square | established analog | half | moderate confidence |
| | | open | low confidence |

Symbols are ink with a paper halo, so they read on paper and on imagery. The eight best-ranked sites
carry a small numbered flag once the map is zoomed in enough to separate them. The selected site is
marked with a survey reticle.

Place names of deserts, plateaus and ranges are set in letter-spaced italic serif, as on a printed
atlas, and thin out with zoom.

### Tooltips

The one dark surface in the interface: charcoal with paper text, like an instrument readout. Order:
site name, place, similarity with the reference region, confidence, status, then a small bar per
dimension with matched dimensions brighter.

### Layer system

Layers are defined in one registry, `web/src/lib/layers.ts`. A layer cannot be added without its
purpose, product, resolution, units, period, limits, source link and its relation to the score.

| Group | Behaviour | Layers |
|---|---|---|
| Similarity | Pipeline output, 0.25° cells, classed or continuous, opacity control | overall and one per dimension |
| Basemap | One at a time | Atlas relief, Sentinel-2 cloudless, Blue Marble with relief, MODIS true colour by day |
| Observations | One at a time, below the similarity layer, with date and opacity | land surface temperature day and night, vegetation index, albedo, land cover, precipitation, surface pressure, column water vapour, snow cover, Sentinel-2 passes, Sentinel-1 radar |
| Reference | Any combination | graticule, coastlines, country boundaries, place names, geologic map units |

Drawing order, bottom to top: basemap, geologic units, observation, similarity, graticule, boundaries,
coastline, cell outline, site symbols.

Conventions:

- An active layer is a filled radio or checkbox, and an active overlay opens to show its facts.
- A layer whose product is also scored carries the tag "same product is scored". It is still only a
  picture here.
- Outside layers are pictures of data. They are never read as numbers and never enter a score.
- When a basemap is dark, coastlines, labels, scale bar and the similarity ramp switch to their light
  forms.
- Radar always appears with a note on what backscatter can and cannot show.

Moon and Mars maps use their own registry of layers from NASA Solar System Treks. The tiles arrive in
plate-carrée form and are re-projected to the map projection in the browser (`web/src/lib/trek.ts`).
Colourised layers that come without a numeric legend say so.

### Small static maps

- **Locator globe** (SVG, orthographic): where a site is on Earth, or a region on Mars or the Moon.
  Planetary locators show a graticule only, since there is no coastline to draw.
- **Portfolio plate** (SVG, Equal Earth): an equal-area world map, the right projection for showing
  how sites are spread. Labels are placed so they do not collide.

## 10. Motion

- Map moves (fly to a site, reset) are the only animated transitions, and MapLibre skips them when the
  reader asks for reduced motion.
- Tiles fade in over 120 ms. "Loading map tiles" appears if tiles take more than a third of a second.
- Nothing animates on scroll or on page load.
- `prefers-reduced-motion` removes all remaining transitions and smooth scrolling.

## 11. Responsive behaviour

| Width | Behaviour |
|---|---|
| ≥ 1540 px | Three columns; the report opens beside the rail and the map |
| 1180–1540 px | With a report open the rail gives its space to the map |
| < 1280 px | Masthead tagline and the "Compare Earth with" label are dropped |
| < 1180 px | Method contents move above the text |
| < 900 px | One column: map, legend as a strip under the map, ranked list or report, then the controls. Multi-column blocks stack; tables scroll sideways inside their own box |
| < 520 px | Locator globes in headers are dropped; class ranges stay |

When the map column is narrower than 600 px (a container query, so it also applies beside an open
report) the legend keeps only its classes. Nothing scientific is removed at any width: every table,
chart, map and note is still present on a phone.

## 12. Accessibility

- Text contrast is at least 4.5:1 on paper; `--faint` is used only for non-text marks.
- Focus is a 2 px ink outline on every control. Table rows and map marks that open a report are
  focusable and respond to Enter.
- State is never carried by colour alone: confidence by fill, evidence kind by pattern, matched
  dimensions by filled against open squares, the selected body by a filled button.
- Maps have text equivalents: the ranked list for site positions, the readout strip for cell values,
  the legend for class ranges, and coordinates in every report.
- Controls have accessible names; toggles use `aria-pressed`, tabs `aria-selected`.
- Map rotation and tilt are off, so north is always up and the north arrow is always true.
