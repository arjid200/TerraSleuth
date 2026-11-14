/**
 * TerraSleuth — Earth System Trend Detective
 * Data Integration & Parser Engine
 * 
 * Handles:
 * - Built-in NASA Case Files in ./data/
 * - Live NASA POWER API Point-Drop Queries (1985-2025)
 * - NASA Giovanni, AppEEARS, and Generic CSV Drag & Drop Parser
 * - NASA Missions & Variables Metadata Catalog
 */

const DataLoader = (() => {

  // NASA Missions & Parameters Knowledge Base
  const VARIABLE_CATALOG = {
    'T2M': {
      id: 'T2M',
      label: '2m Air Temperature',
      unit: '°C',
      mission: 'NASA MERRA-2 / POWER',
      missionDescription: 'Data sourced from NASA POWER / MERRA-2 reanalysis model (0.5° × 0.625° spatial resolution, covering a ~50–70 km grid cell per point).',
      description: 'How warm the air is about 2 meters above the ground. A steady rise over decades signals a warming climate.',
      earthSystemRole: 'Direct indicator of tropospheric warming, heatwave intensity, and surface energy balance.'
    },
    'PRECTOTCORR': {
      id: 'PRECTOTCORR',
      label: 'Precipitation',
      unit: 'mm/day',
      mission: 'NASA MERRA-2 / GPM',
      missionDescription: 'Data sourced from NASA POWER / MERRA-2 reanalysis model (0.5° × 0.625° spatial resolution, covering a ~50–70 km grid cell per point).',
      description: 'The average amount of rain or snow falling per day. Changes can mean more droughts, floods, or shifting monsoons.',
      earthSystemRole: 'Governs freshwater budgets, agricultural viability, seasonal monsoons, and drought onset.'
    },
    'ALLSKY_SFC_SW_DWN': {
      id: 'ALLSKY_SFC_SW_DWN',
      label: 'Surface Solar Radiation',
      unit: 'MJ/m²/day',
      mission: 'NASA CERES / FLASHFlux',
      missionDescription: 'Data sourced from NASA POWER / MERRA-2 reanalysis model (0.5° × 0.625° spatial resolution, covering a ~50–70 km grid cell per point).',
      description: 'All-sky downward solar shortwave flux reaching the Earth surface, accounting for cloud optical thickness, aerosol scattering, and water vapor absorption.',
      earthSystemRole: 'Primary driver of photosynthesis, surface evaporation, and convective cloud formation.'
    },
    'RH2M': {
      id: 'RH2M',
      label: 'Relative Humidity',
      unit: '%',
      mission: 'NASA MERRA-2 / AIRS',
      missionDescription: 'Data sourced from NASA POWER / MERRA-2 reanalysis model (0.5° × 0.625° spatial resolution, covering a ~50–70 km grid cell per point).',
      description: 'Ratio of atmospheric water vapor pressure to saturation vapor pressure at 2 meters above surface level.',
      earthSystemRole: 'Regulates wildfire susceptibility, ecological transpiration stress, and convective thunderstorm potential.'
    }
  };

  // Featured NASA Case Files stored in ./data/
  const CASE_FILES = [
    {
      id: 'amazon_manaus',
      name: 'Amazon Rainforest',
      region: 'Manaus, Brazil (003d10S_060d00W)',
      lat: -3.10,
      lon: -60.00,
      elevation: 51.4,
      filePath: './data/POWER_Point_Monthly_19950101_20241231_003d10S_060d00W_LST.csv',
      category: 'Tropical Rainforest / Drought',
      defaultParam: 'T2M',
      oppositePairId: 'sahel_niamey',
      badge: 'Deforestation & Thermal Surge',
      story: 'A hotter, drier Amazon stores less carbon and is more prone to fires.',
      detectiveStory: {
        clue: 'Temperature rose about 0.35°C per decade while rainfall fell about 0.5 mm/day per decade, and both trends are significant. The hottest year was 2024 (28.8°C) and the driest was 2015.',
        suspect: 'Deforestation and drought linked to global warming and El Niño.',
        whyItMatters: 'A hotter, drier Amazon stores less carbon and is more prone to fires.'
      }
    },
    {
      id: 'arctic_fram',
      name: 'Arctic Ocean',
      region: 'Fram Strait (080d00N_000d01E)',
      lat: 80.00,
      lon: 0.01,
      elevation: 0.0,
      filePath: './data/POWER_Point_Monthly_19950101_20241231_080d00N_000d01E_LST.csv',
      category: 'Polar & Cryosphere',
      defaultParam: 'T2M',
      oppositePairId: 'antarctic_weddell',
      badge: 'Arctic Amplification & High Variance',
      story: 'A critical lesson in scientific honesty—while the broader Arctic warms faster than the global average, a single grid point may not show statistical significance over a 30-year window.',
      detectiveStory: {
        clue: 'The temperature trend is upward (+0.16°C per decade) but not statistically significant here, because Arctic years vary widely (between -9.2°C and -5.1°C).',
        suspect: 'High year-to-year variability is masking the long-term trend at this single grid point.',
        whyItMatters: 'A critical lesson in scientific honesty—while the broader Arctic warms faster than the global average, a single grid point may not show statistical significance over a 30-year window.'
      }
    },
    {
      id: 'monsoon_kochi',
      name: 'Kochi, Kerala',
      region: 'Southwest Coast (009d93N_076d27E)',
      lat: 9.93,
      lon: 76.27,
      elevation: 47.3,
      filePath: './data/POWER_Point_Monthly_19950101_20241231_009d93N_076d27E_LST.csv',
      category: 'Monsoon Tropics',
      defaultParam: 'T2M',
      oppositePairId: 'amazon_manaus',
      badge: 'Monsoon Warming & Flood Risk',
      story: 'Kochi is getting hotter while its monsoon remains unpredictable, raising heat stress and flood risk.',
      detectiveStory: {
        clue: 'Average temperature rose about 0.27°C per decade, a statistically significant trend, from about 27.1°C to 27.7°C (first vs. last 5 years).',
        suspect: 'Regional warming and urban growth. Rainfall shows no clear trend, with a mean of about 7.2 mm/day and big swings from year to year.',
        whyItMatters: 'Kochi is getting hotter while its monsoon remains unpredictable, raising heat stress and flood risk.'
      }
    },
    {
      id: 'antarctic_weddell',
      name: 'Weddell Sea Coast',
      region: 'Antarctic Ice Shelf (-75°S, -40°W)',
      lat: -75.00,
      lon: -40.00,
      elevation: 120.0,
      filePath: './data/POWER_Point_Monthly_19950101_20241231_075d00S_040d00W_LST.csv',
      category: 'Polar Asymmetry',
      defaultParam: 'T2M',
      oppositePairId: 'arctic_fram',
      badge: 'Antarctic Polar Buffer',
      story: 'Contrasting the rapid warming of the High Arctic, the Weddell Sea continental perimeter displays polar asymmetry—stabilized by the Southern Ocean circum-polar vortex and high-elevation ice mass.'
    },
    {
      id: 'sahel_niamey',
      name: 'Sahel Savannah',
      region: 'Niamey, Niger',
      lat: 13.51,
      lon: 2.12,
      elevation: 241.6,
      filePath: './data/POWER_Point_Monthly_19950101_20241231_013d51N_002d12E_LST.csv',
      category: 'Semi-Arid Transition',
      defaultParam: 'PRECTOTCORR',
      oppositePairId: 'amazon_manaus',
      badge: 'Sahel Greening & Rain Rebound',
      story: 'Following severe 20th-century droughts, the West African Sahel has experienced a partial rainfall recovery and vegetation greening, representing a stark contrast to Amazon drying trends.'
    }
  ];

  // In-memory query cache for live API responses
  const apiCache = new Map();

  /**
   * Parse NASA POWER Monthly Point CSV Format
   */
  function parsePowerCSV(text, fallbackFileName = 'Local Case File') {
    const lines = text.split(/\r?\n/);
    let lat = null, lon = null, elevation = null;
    let inHeader = false;
    let dataStartIndex = -1;
    const headerParams = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '-BEGIN HEADER-') {
        inHeader = true;
        continue;
      }
      if (line === '-END HEADER-') {
        inHeader = false;
        continue;
      }
      if (inHeader) {
        const locMatch = line.match(/Location:\s+Latitude\s+([-\d.]+)\s+Longitude\s+([-\d.]+)/i);
        if (locMatch) {
          lat = parseFloat(locMatch[1]);
          lon = parseFloat(locMatch[2]);
        }
        const elevMatch = line.match(/Elevation\s+from\s+MERRA-2:.*?=\s*([-\d.]+)\s*meters/i);
        if (elevMatch) {
          elevation = parseFloat(elevMatch[1]);
        }
        // Parameter definitions in header
        const pMatch = line.match(/^([A-Z0-9_]+)\s{2,}(.+)$/);
        if (pMatch && pMatch[1] !== 'Location' && pMatch[1] !== 'Dates' && pMatch[1] !== 'Elevation') {
          headerParams[pMatch[1]] = pMatch[2].trim();
        }
      }
      if (line.startsWith('PARAMETER,YEAR')) {
        dataStartIndex = i + 1;
        break;
      }
    }

    if (dataStartIndex === -1) {
      // Not a standard POWER header, attempt generic CSV parsing
      return parseGenericCSV(text, fallbackFileName);
    }

    const series = {}; // param -> [{ date, x, year, month, value }]

    for (let i = dataStartIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(',');
      if (parts.length < 14) continue;

      const param = parts[0].trim();
      const year = parseInt(parts[1], 10);
      if (isNaN(year)) continue;

      if (!series[param]) series[param] = [];

      for (let m = 0; m < 12; m++) {
        const val = parseFloat(parts[2 + m]);
        if (!isNaN(val) && val !== -999 && val > -900) {
          const monthNum = m + 1;
          const monthStr = String(monthNum).padStart(2, '0');
          series[param].push({
            date: `${year}-${monthStr}`,
            x: year + (m + 0.5) / 12,
            year: year,
            month: monthNum,
            value: val
          });
        }
      }
    }

    // Sort series chronologically
    for (const p in series) {
      series[p].sort((a, b) => a.x - b.x);
    }

    const paramKeys = Object.keys(series);
    if (paramKeys.length === 0) {
      throw new Error('No valid time series parameters could be parsed from the CSV.');
    }

    return {
      type: 'power_csv',
      title: fallbackFileName,
      lat: lat !== null ? lat : 0,
      lon: lon !== null ? lon : 0,
      elevation: elevation !== null ? elevation : 0,
      parameters: paramKeys,
      headerDescriptions: headerParams,
      series: series
    };
  }

  /**
   * Generic CSV Parser (for NASA Giovanni, AppEEARS, or custom station files)
   */
  function parseGenericCSV(text, fileName = 'Uploaded Dataset') {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) throw new Error('CSV file has insufficient lines.');

    // Find header line (first line without comment #)
    let headerLineIndex = 0;
    while (headerLineIndex < lines.length && lines[headerLineIndex].startsWith('#')) {
      headerLineIndex++;
    }

    const header = lines[headerLineIndex].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    const series = {};
    const dateColIdx = header.findIndex(h => /^(date|time|timestamp|year_month|datetime|year)/i.test(h));
    
    if (dateColIdx === -1) {
      // If no explicit date column, use index or first column
      throw new Error('Could not identify a Date or Year column in the uploaded CSV.');
    }

    // Value columns
    const valCols = [];
    for (let c = 0; c < header.length; c++) {
      if (c !== dateColIdx && !/^(lat|lon|latitude|longitude|id|elevation)/i.test(header[c])) {
        valCols.push({ index: c, name: header[c] });
        series[header[c]] = [];
      }
    }

    if (valCols.length === 0) throw new Error('No numeric data columns found.');

    for (let i = headerLineIndex + 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length <= dateColIdx) continue;

      const rawDate = parts[dateColIdx];
      let year = null, month = 1, x = null, dateStr = rawDate;

      // Handle YYYY-MM or YYYY/MM or YYYYMM or bare YYYY
      if (/^\d{4}-\d{2}/.test(rawDate)) {
        const dp = rawDate.split('-');
        year = parseInt(dp[0], 10);
        month = parseInt(dp[1], 10);
        x = year + (month - 0.5) / 12;
        dateStr = `${year}-${String(month).padStart(2, '0')}`;
      } else if (/^\d{4}\/\d{2}/.test(rawDate)) {
        const dp = rawDate.split('/');
        year = parseInt(dp[0], 10);
        month = parseInt(dp[1], 10);
        x = year + (month - 0.5) / 12;
        dateStr = `${year}-${String(month).padStart(2, '0')}`;
      } else if (/^\d{4}$/.test(rawDate)) {
        year = parseInt(rawDate, 10);
        month = 6;
        x = year + 0.5;
        dateStr = `${year}`;
      } else {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          year = d.getUTCFullYear();
          month = d.getUTCMonth() + 1;
          x = year + (month - 0.5) / 12;
          dateStr = `${year}-${String(month).padStart(2, '0')}`;
        }
      }

      if (year === null || isNaN(year)) continue;

      for (const col of valCols) {
        const val = parseFloat(parts[col.index]);
        if (!isNaN(val) && val !== -999 && val > -900) {
          series[col.name].push({
            date: dateStr,
            x: x,
            year: year,
            month: month,
            value: val
          });
        }
      }
    }

    for (const col of valCols) {
      series[col.name].sort((a, b) => a.x - b.x);
    }

    return {
      type: 'generic_csv',
      title: fileName,
      lat: 0,
      lon: 0,
      elevation: 0,
      parameters: valCols.map(c => c.name),
      headerDescriptions: {},
      series: series
    };
  }

  /**
   * Load local case file by relative path
   */
  async function loadCaseFile(caseFileObj) {
    // If running under file:// protocol, directly use preloaded data to avoid browser CORS restriction
    if (typeof PRELOADED_CASE_DATA !== 'undefined' && PRELOADED_CASE_DATA[caseFileObj.id]) {
      if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
        return JSON.parse(JSON.stringify(PRELOADED_CASE_DATA[caseFileObj.id]));
      }
    }

    try {
      const resp = await fetch(caseFileObj.filePath);
      if (!resp.ok) throw new Error(`HTTP ${resp.status} while fetching ${caseFileObj.filePath}`);
      const text = await resp.text();
      const parsed = parsePowerCSV(text, caseFileObj.name);

      // Merge rich case file metadata
      parsed.id = caseFileObj.id;
      parsed.name = caseFileObj.name;
      parsed.region = caseFileObj.region;
      parsed.lat = caseFileObj.lat;
      parsed.lon = caseFileObj.lon;
      parsed.elevation = caseFileObj.elevation;
      parsed.category = caseFileObj.category;
      parsed.story = caseFileObj.story;
      parsed.oppositePairId = caseFileObj.oppositePairId;
      parsed.badge = caseFileObj.badge;
      parsed.detectiveStory = caseFileObj.detectiveStory;

      return parsed;
    } catch (err) {
      if (typeof PRELOADED_CASE_DATA !== 'undefined' && PRELOADED_CASE_DATA[caseFileObj.id]) {
        console.warn('Local fetch failed, using preloaded case data fallback:', err.message);
        return JSON.parse(JSON.stringify(PRELOADED_CASE_DATA[caseFileObj.id]));
      }
      console.error('Failed to load case file:', caseFileObj.filePath, err);
      throw err;
    }
  }

  /**
   * Live NASA POWER API Query
   * Monthly temporal point request from 1985 to 2025
   */
  async function fetchLiveNASAPower(lat, lon, startYear = 1985, endYear = 2025) {
    const roundedLat = parseFloat(lat.toFixed(4));
    const roundedLon = parseFloat(lon.toFixed(4));
    const cacheKey = `${roundedLat},${roundedLon},${startYear},${endYear}`;

    if (apiCache.has(cacheKey)) {
      return apiCache.get(cacheKey);
    }

    const params = 'T2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN,RH2M';
    const url = `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=${params}&community=AG&longitude=${roundedLon}&latitude=${roundedLat}&start=${startYear}&end=${endYear}&format=JSON`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 18000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`NASA POWER API returned HTTP ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      const paramData = json?.properties?.parameter;
      if (!paramData) throw new Error('NASA POWER response missing properties.parameter payload.');

      const elevation = json?.geometry?.coordinates?.[2] || 0;
      const series = {};

      for (const pKey in paramData) {
        const rawDict = paramData[pKey];
        series[pKey] = [];

        for (const ymKey in rawDict) {
          // ymKey format: "YYYYMM"
          if (ymKey.length !== 6) continue;
          const year = parseInt(ymKey.substring(0, 4), 10);
          const monthStr = ymKey.substring(4, 6);
          const month = parseInt(monthStr, 10);

          // Month 13 is annual summary in NASA POWER API; skip for monthly series
          if (month < 1 || month > 12) continue;

          const val = rawDict[ymKey];
          if (typeof val === 'number' && val !== -999 && val > -900) {
            series[pKey].push({
              date: `${year}-${monthStr}`,
              x: year + (month - 0.5) / 12,
              year: year,
              month: month,
              value: val
            });
          }
        }
        series[pKey].sort((a, b) => a.x - b.x);
      }

      const result = {
        type: 'nasa_power_live',
        title: `Live Point [${roundedLat > 0 ? roundedLat + '°N' : Math.abs(roundedLat) + '°S'}, ${roundedLon > 0 ? roundedLon + '°E' : Math.abs(roundedLon) + '°W'}]`,
        region: `Custom Coordinates (${roundedLat.toFixed(2)}°, ${roundedLon.toFixed(2)}°)`,
        lat: roundedLat,
        lon: roundedLon,
        elevation: elevation,
        category: 'Live NASA Investigation',
        parameters: Object.keys(series),
        series: series,
        story: `Freshly streamed via NASA POWER API (1985–${endYear}) combining satellite radiometry and GMAO MERRA-2 Earth system reanalysis.`
      };

      apiCache.set(cacheKey, result);
      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn('Live NASA POWER query failed:', err.message);
      throw err;
    }
  }

  /**
   * Variable Metadata Lookup Helper
   */
  function getVariableMeta(paramKey) {
    if (VARIABLE_CATALOG[paramKey]) {
      return VARIABLE_CATALOG[paramKey];
    }
    // Dynamic fallback for custom uploaded columns
    return {
      id: paramKey,
      label: paramKey.replace(/_/g, ' '),
      unit: '',
      mission: 'User Dataset / Custom Source',
      missionDescription: 'User uploaded tabular dataset',
      description: `Custom analytical observation variable: ${paramKey}`,
      earthSystemRole: 'Analyzed using TerraSleuth Non-Parametric Forensics.'
    };
  }

  return {
    VARIABLE_CATALOG,
    CASE_FILES,
    parsePowerCSV,
    parseGenericCSV,
    loadCaseFile,
    fetchLiveNASAPower,
    getVariableMeta
  };

})();

// Export for module or browser window
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DataLoader;
}
