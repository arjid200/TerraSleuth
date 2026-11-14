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

## Data Attribution

TerraSleuth incorporates open data products provided by NASA projects and missions:

- **NASA POWER Project**: Surface meteorology and solar energy parameters.
- **NASA MERRA-2**: Global atmospheric reanalysis modeling from the Goddard Earth Observing System.
- **NASA GPM**: Satellite precipitation retrievals and radar measurements.
- **NASA CERES, MODIS, AIRS, and GLDAS**: Multi-sensor Earth observation inputs for radiation, atmospheric moisture, and land surface modeling.

## Technical Details

- **Frontend**: Clean HTML5, CSS3, and vanilla JavaScript (no build tools or compilation required).
- **Libraries**: Leaflet.js for mapping, Chart.js for data visualization.
- **Design**: Space Apps compliant styling using original geometric SVG icons and text-based badges.

## Disclosure

Developed with assistance from Google Antigravity to accelerate development and statistical algorithm implementation.

## License

MIT License.
