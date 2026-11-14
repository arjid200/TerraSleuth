# TerraSleuth — Earth System Trend Detective

A responsive, single-page web application for detecting and analyzing multi-decadal trends, environmental shifts, and climate changepoints across planetary systems.

Built for educators, students, and researchers, TerraSleuth integrates open NASA Earth science datasets with non-parametric statistical forensics to deliver intuitive, evidence-based verdicts on regional environmental changes.

## Capabilities

- **Interactive Geospatial Exploration**: Dark-themed interactive map with pin-drop telemetry. Click any location worldwide to query monthly climate metrics from 1985 to 2025.
- **Pre-Loaded Planetary Case Files**: Fast access to 30-year observational records across distinct biomes (High Arctic, Amazon Basin, Southwest India, Antarctica, and the Sahel).
- **Non-Parametric Statistical Forensics**:
  - Theil-Sen median slope estimation for robust trend rates per decade.
  - Mann-Kendall test for rank trend significance ($S$, $Z$, and $p$-value).
  - Pettitt test for detecting abrupt structural breaks and changepoint years.
  - 95% confidence intervals and 12-month rolling deseasonalization.
- **Detective Verdict**: Automated plain-language narrative explaining observed changes, confidence levels, and physical drivers.
- **Comparative Analysis**: Split-view mode for contrasting asymmetric responses in opposing regions (e.g., Arctic amplification versus Antarctic stability).
- **Custom Data Upload**: Drag-and-drop CSV ingestion for user-provided observational series.

## Data Attribution & Grid Resolution

Data sourced from NASA POWER / MERRA-2 reanalysis model (0.5° × 0.625° spatial resolution, covering a ~50–70 km grid cell per point).

TerraSleuth incorporates open data products provided by NASA projects and missions:

- **NASA POWER Project**: Surface meteorology and solar energy parameters.
- **NASA MERRA-2**: Global atmospheric reanalysis modeling from the Goddard Earth Observing System.
- **NASA GPM**: Satellite precipitation retrievals and radar measurements.
- **NASA CERES, MODIS, AIRS, and GLDAS**: Multi-sensor Earth observation inputs for radiation, atmospheric moisture, and land surface modeling.

### Featured Case File Detective Stories

- **Kochi, Kerala (009d93N_076d27E)**:
  - *Clue*: Average temperature rose about 0.27°C per decade, a statistically significant trend, from about 27.1°C to 27.7°C (first vs. last 5 years).
  - *Suspect*: Regional warming and urban growth. Rainfall shows no clear trend, with a mean of about 7.2 mm/day and big swings from year to year.
  - *Why it matters*: Kochi is getting hotter while its monsoon remains unpredictable, raising heat stress and flood risk.
- **Amazon Rainforest (003d10S_060d00W)**:
  - *Clue*: Temperature rose about 0.35°C per decade while rainfall fell about 0.5 mm/day per decade, and both trends are significant. The hottest year was 2024 (28.8°C) and the driest was 2015.
  - *Suspect*: Deforestation and drought linked to global warming and El Niño.
  - *Why it matters*: A hotter, drier Amazon stores less carbon and is more prone to fires.
- **Arctic Ocean (080d00N_000d01E)**:
  - *Clue*: The temperature trend is upward (+0.16°C per decade) but not statistically significant here, because Arctic years vary widely (between -9.2°C and -5.1°C).
  - *Suspect*: High year-to-year variability is masking the long-term trend at this single grid point.
  - *Why it matters*: A critical lesson in scientific honesty—while the broader Arctic warms faster than the global average, a single grid point may not show statistical significance over a 30-year window.

## Technical Details

- **Frontend**: Clean HTML5, CSS3, and vanilla JavaScript (no build tools or compilation required).
- **Libraries**: Leaflet.js for mapping, Chart.js for data visualization.
- **Design**: Space Apps compliant styling using original geometric SVG icons and text-based badges.

## Disclosure

Developed with assistance from Google Antigravity to accelerate development and statistical algorithm implementation.

## License

MIT License.
