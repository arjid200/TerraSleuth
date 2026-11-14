/**
 * TerraSleuth — Earth System Trend Detective
 * Main Application Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

const App = (() => {

  // State Management
  const state = {
    currentDataset: null,         // Active parsed dataset object
    selectedParam: 'T2M',        // Currently selected parameter
    deseasonalize: true,         // 12-month rolling average toggle
    timeWindow: 'all',           // 'all', '1995-2024', '2000-2024', 'last10'
    isCompareMode: false,        // Dual-region compare mode toggle
    compareDatasetA: null,
    compareDatasetB: null,
    comparePairId: 'polar_asymmetry',
    activeMarker: null,
    compareMarkers: [],
    map: null,
    chart: null,
    compareChart: null,
    isFetchingLive: false
  };

  /**
   * Application Initialization
   */
  async function init() {
    initMap();
    initChart();
    renderCaseFilePills();
    setupEventListeners();
    setupModals();
    setupDropzone();

    // Load initial Featured Case File: High Arctic (Fram Strait)
    const defaultCase = DataLoader.CASE_FILES.find(c => c.id === 'arctic_fram') || DataLoader.CASE_FILES[0];
    await selectCaseFile(defaultCase.id);
  }

  /**
   * Leaflet Map Initialization
   */
  function initMap() {
    // Dark matter theme tiles (CartoDB Dark Matter with labels)
    state.map = L.map('leafletMap', {
      center: [20, 0],
      zoom: 2,
      minZoom: 1,
      maxZoom: 12,
      zoomControl: true,
      attributionControl: false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(state.map);

    // Live Map Pin-Drop Event Listener
    state.map.on('click', async (e) => {
      const { lat, lng } = e.latlng;
      // Wrap longitude between -180 and 180
      const wrappedLng = ((lng + 180) % 360 + 360) % 360 - 180;
      await handleMapPointDrop(lat, wrappedLng);
    });

    // Update HUD on mouse movement over map
    state.map.on('mousemove', (e) => {
      const hudEl = document.getElementById('mapMouseCoord');
      if (hudEl) {
        const wrappedLng = ((e.latlng.lng + 180) % 360 + 360) % 360 - 180;
        hudEl.textContent = `${e.latlng.lat.toFixed(2)}°, ${wrappedLng.toFixed(2)}°`;
      }
    });
  }

  /**
   * Handle Click Anywhere on Map: Drop Pin & Query Live NASA POWER API
   */
  async function handleMapPointDrop(lat, lon) {
    if (state.isFetchingLive) return;

    // Smooth camera glide
    state.map.flyTo([lat, lon], Math.max(state.map.getZoom(), 4), {
      duration: 1.2,
      easeLinearity: 0.25
    });

    // Set Pulsing Radar Pin
    setMapPin(lat, lon, `Live Point (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`);

    // UI Feedback: Loading Shimmer
    setLiveLoadingState(true);
    showToast(`Streaming NASA POWER monthly data for [${lat.toFixed(2)}°, ${lon.toFixed(2)}°]...`);

    try {
      const liveData = await DataLoader.fetchLiveNASAPower(lat, lon, 1985, 2025);
      state.currentDataset = liveData;

      // Update Case File Pills selection (unselect presets)
      document.querySelectorAll('.case-pill').forEach(p => p.classList.remove('active'));

      // If current variable is not present, default to T2M
      if (!liveData.parameters.includes(state.selectedParam)) {
        state.selectedParam = liveData.parameters[0] || 'T2M';
      }

      updateVariableSelectorUI();
      updateAppUI();
      showToast(`Successfully loaded 1985–2025 NASA records for ${liveData.title}`, 'success');
    } catch (err) {
      console.error('NASA POWER API query error:', err);
      showToast(`NASA POWER live query unavailable: ${err.message}. Retaining current file.`, 'error');
    } finally {
      setLiveLoadingState(false);
    }
  }

  /**
   * Set Custom Leaflet Radar Pin with concentric pulsing rings
   */
  function setMapPin(lat, lon, popupText) {
    if (state.activeMarker) {
      state.map.removeLayer(state.activeMarker);
    }

    const pinIcon = L.divIcon({
      className: 'radar-pin-container',
      html: `
        <div class="radar-pin-core"></div>
        <div class="radar-pin-ring"></div>
        <div class="radar-pin-ring ring-2"></div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    state.activeMarker = L.marker([lat, lon], { icon: pinIcon })
      .addTo(state.map)
      .bindPopup(`<strong style="color:#0B1120;">${popupText}</strong><br><span style="color:#475569;font-size:11px;">Lat: ${lat.toFixed(2)}°, Lon: ${lon.toFixed(2)}°</span>`);

    // Update Coordinate HUD
    const hud = document.getElementById('mapCurrentPin');
    if (hud) hud.textContent = `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
  }

  /**
   * Render Featured Case File Pills above map
   */
  function renderCaseFilePills() {
    const container = document.getElementById('casePillsContainer');
    if (!container) return;

    container.innerHTML = '';

    DataLoader.CASE_FILES.forEach(cf => {
      const pill = document.createElement('button');
      pill.className = `case-pill ${cf.id === 'arctic_fram' ? 'active' : ''}`;
      pill.dataset.id = cf.id;
      pill.innerHTML = `
        <span>${cf.name}</span>
        <span class="pill-tag">${cf.category.split('/')[0].trim()}</span>
      `;

      pill.addEventListener('click', () => {
        selectCaseFile(cf.id);
      });

      container.appendChild(pill);
    });

    // Custom Upload Pill
    const uploadPill = document.createElement('button');
    uploadPill.className = 'case-pill upload-pill';
    uploadPill.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      <span>+ Upload CSV</span>
    `;
    uploadPill.addEventListener('click', () => {
      openModal('uploadModal');
    });
    container.appendChild(uploadPill);
  }

  /**
   * Select and load a Case File by ID
   */
  async function selectCaseFile(caseId) {
    const caseObj = DataLoader.CASE_FILES.find(c => c.id === caseId);
    if (!caseObj) return;

    // Highlight pill
    document.querySelectorAll('.case-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.id === caseId);
    });

    try {
      const data = await DataLoader.loadCaseFile(caseObj);
      state.currentDataset = data;

      // Set parameter
      if (caseObj.defaultParam && data.parameters.includes(caseObj.defaultParam)) {
        state.selectedParam = caseObj.defaultParam;
      } else if (!data.parameters.includes(state.selectedParam)) {
        state.selectedParam = data.parameters[0] || 'T2M';
      }

      // Smooth camera glide
      state.map.flyTo([data.lat, data.lon], 4.5, {
        duration: 1.5,
        easeLinearity: 0.25
      });

      // Update Pin
      setMapPin(data.lat, data.lon, `${data.name} — ${data.region}`);

      updateVariableSelectorUI();
      updateAppUI();
    } catch (err) {
      console.error('Error loading case file:', err);
      showToast(`Could not load case file: ${err.message}`, 'error');
    }
  }

  /**
   * Update Variable Selector buttons & information popover
   */
  function updateVariableSelectorUI() {
    const container = document.getElementById('variablesStrip');
    if (!container || !state.currentDataset) return;

    container.innerHTML = '';
    const params = state.currentDataset.parameters;

    params.forEach(p => {
      const meta = DataLoader.getVariableMeta(p);
      const btn = document.createElement('button');
      btn.className = `var-btn ${p === state.selectedParam ? 'active' : ''}`;
      btn.dataset.param = p;
      btn.innerHTML = `
        <span>${meta.label}</span>
        ${meta.unit ? `<span style="font-family:var(--font-mono);font-size:0.7rem;opacity:0.75;">(${meta.unit})</span>` : ''}
      `;

      btn.addEventListener('click', () => {
        state.selectedParam = p;
        document.querySelectorAll('.var-btn').forEach(b => b.classList.toggle('active', b.dataset.param === p));
        updateVariableExplainer(meta);
        updateAppUI();
      });

      container.appendChild(btn);
    });

    const activeMeta = DataLoader.getVariableMeta(state.selectedParam);
    updateVariableExplainer(activeMeta);
  }

  /**
   * Update Variable Explainer Box
   */
  function updateVariableExplainer(meta) {
    const nameEl = document.getElementById('varExplainerName');
    const badgeEl = document.getElementById('varExplainerMission');
    const descEl = document.getElementById('varExplainerDesc');
    const roleEl = document.getElementById('varExplainerRole');

    if (nameEl) nameEl.textContent = `${meta.label} ${meta.unit ? `[${meta.unit}]` : ''}`;
    if (badgeEl) badgeEl.textContent = meta.mission || 'NASA Mission Source';
    if (descEl) descEl.textContent = meta.description || '';
    if (roleEl) roleEl.innerHTML = `<strong>Earth System Forensic Role:</strong> ${meta.earthSystemRole || ''}`;
  }

  /**
   * Core UI Update & Forensics Computation
   */
  function updateAppUI() {
    if (!state.currentDataset) return;

    if (state.isCompareMode) {
      renderCompareMode();
      return;
    }

    const seriesData = state.currentDataset.series[state.selectedParam];
    if (!seriesData || seriesData.length === 0) {
      showToast(`No series data found for ${state.selectedParam}`, 'error');
      return;
    }

    // Filter series based on timeWindow
    const filteredSeries = filterSeriesByTimeWindow(seriesData, state.timeWindow);

    // Run Statistical Forensics Engine
    const meta = DataLoader.getVariableMeta(state.selectedParam);
    const deseasonalizeMode = state.deseasonalize ? 'rolling12' : 'raw';
    const forensics = ForensicsEngine.analyzeSeries(filteredSeries, meta, deseasonalizeMode);

    if (!forensics) {
      showToast('Insufficient data points for robust statistical forensics.', 'error');
      return;
    }

    // Update KPI Metric Cards with Animated Count-ups
    updateKPICards(forensics, meta);

    // Update Detective Verdict Card
    updateDetectiveVerdictCard(forensics.verdict, state.currentDataset, meta);

    // Update Time Series Chart
    renderChart(forensics, meta, state.currentDataset);
  }

  /**
   * Filter Time Series by Selected Window
   */
  function filterSeriesByTimeWindow(series, windowKey) {
    if (!series || series.length === 0) return [];
    if (windowKey === 'all') return series;

    const maxYear = series[series.length - 1].year;

    if (windowKey === '1995-2024') {
      return series.filter(p => p.year >= 1995 && p.year <= 2024);
    }
    if (windowKey === '2000-2024') {
      return series.filter(p => p.year >= 2000 && p.year <= 2024);
    }
    if (windowKey === 'last10') {
      return series.filter(p => p.year >= maxYear - 10);
    }
    return series;
  }

  /**
   * Animate Number Count-Up for Metric Cards
   */
  function animateValue(element, start, end, duration, decimals = 2, prefix = '', suffix = '') {
    if (!element) return;
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * easeProgress;
      element.textContent = `${prefix}${current.toFixed(decimals)}${suffix}`;

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        element.textContent = `${prefix}${end.toFixed(decimals)}${suffix}`;
      }
    }

    requestAnimationFrame(update);
  }

  /**
   * Update KPI Cards
   */
  function updateKPICards(forensics, meta) {
    const { mk, sen, pettitt } = forensics;
    const unit = meta.unit ? ` ${meta.unit}` : '';

    // 1. Rate of Change / Decade
    const kpiSlopeVal = document.getElementById('kpiSlopeValue');
    const kpiSlopeSub = document.getElementById('kpiSlopeSub');
    const slopeDecade = sen.slopePerDecade;
    animateValue(kpiSlopeVal, 0, slopeDecade, 800, 3, slopeDecade >= 0 ? '+' : '', `${unit}/dec`);
    if (kpiSlopeSub) kpiSlopeSub.textContent = `OLS Slope: ${forensics.ols.slope >= 0 ? '+' : ''}${(forensics.ols.slope * 10).toFixed(3)}${unit}/dec`;

    // 2. Mann-Kendall Trend Test
    const kpiMKVal = document.getElementById('kpiMKValue');
    const kpiMKSub = document.getElementById('kpiMKSub');
    if (kpiMKVal) {
      kpiMKVal.textContent = mk.pVal < 0.0001 ? 'p < 0.0001' : `p = ${mk.pVal.toFixed(4)}`;
      kpiMKVal.style.color = mk.isSignificant ? 'var(--accent-coral)' : 'var(--accent-emerald)';
    }
    if (kpiMKSub) kpiMKSub.textContent = `Z = ${mk.z.toFixed(2)} | S = ${mk.s >= 0 ? '+' : ''}${mk.s}`;

    // 3. 95% Confidence Interval
    const kpiCIVal = document.getElementById('kpiCIValue');
    const kpiCISub = document.getElementById('kpiCISub');
    if (kpiCIVal) {
      kpiCIVal.textContent = `[${sen.ciLowerDecade.toFixed(2)}, ${sen.ciUpperDecade.toFixed(2)}]`;
    }
    if (kpiCISub) kpiCISub.textContent = `Sen's Non-Parametric Rank Limits`;

    // 4. Changepoint Year
    const kpiCPVal = document.getElementById('kpiCPValue');
    const kpiCPSub = document.getElementById('kpiCPSub');
    if (kpiCPVal) {
      const year = parseInt(forensics.verdict.changepointYear, 10);
      if (!isNaN(year)) {
        animateValue(kpiCPVal, year - 10, year, 800, 0);
      } else {
        kpiCPVal.textContent = forensics.verdict.changepointYear;
      }
    }
    if (kpiCPSub) {
      kpiCPSub.textContent = `Shift Δ: ${forensics.verdict.shiftDeltaFormatted}`;
    }
  }

  /**
   * Update Detective Verdict Card
   */
  function updateDetectiveVerdictCard(verdict, dataset, meta) {
    const cardEl = document.getElementById('verdictCard');
    const badgeEl = document.getElementById('verdictBadge');
    const confEl = document.getElementById('verdictConfidence');
    const bodyEl = document.getElementById('verdictBody');
    const ecoEl = document.getElementById('verdictEcological');

    if (!cardEl || !badgeEl || !bodyEl) return;

    // Style card by significance
    cardEl.className = `card verdict-card ${verdict.statusClass}`;

    badgeEl.className = `verdict-status-badge ${verdict.isSignificant ? 'significant' : 'not-significant'}`;
    badgeEl.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        ${verdict.isSignificant ? '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>' : '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>'}
      </svg>
      <span>${verdict.statusTitle}</span>
    `;

    if (confEl) {
      confEl.innerHTML = `Forensic Certainty: <strong>${verdict.confidencePct}%</strong>`;
    }

    bodyEl.innerHTML = verdict.summaryText;

    if (ecoEl) {
      ecoEl.innerHTML = `<strong>Earth System Mechanism:</strong> ${verdict.ecologicalContext}<br><span style="font-size:0.68rem;opacity:0.7;">${verdict.deseasonalizeNote}</span>`;
    }
  }

  /**
   * Chart.js Time Series Visualization
   */
  function initChart() {
    const ctx = document.getElementById('timeSeriesChart').getContext('2d');

    state.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: []
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 750,
          easing: 'easeOutQuart'
        },
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            titleColor: '#F8FAFC',
            bodyColor: '#CBD5E1',
            borderColor: 'rgba(56, 189, 248, 0.4)',
            borderWidth: 1,
            padding: 12,
            titleFont: { family: 'Plus Jakarta Sans', weight: 'bold', size: 13 },
            bodyFont: { family: 'JetBrains Mono', size: 12 },
            callbacks: {
              label: (ctx) => {
                const label = ctx.dataset.label || '';
                const val = ctx.parsed.y;
                return ` ${label}: ${val !== null ? val.toFixed(3) : 'N/A'}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.05)',
              drawBorder: false
            },
            ticks: {
              color: '#94A3B8',
              font: { family: 'JetBrains Mono', size: 11 },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 10
            }
          },
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.06)',
              drawBorder: false
            },
            ticks: {
              color: '#94A3B8',
              font: { family: 'JetBrains Mono', size: 11 }
            }
          }
        }
      }
    });
  }

  /**
   * Render Chart Datasets & Changepoint Line
   */
  function renderChart(forensics, meta, dataset) {
    if (!state.chart) return;

    const { workingPoints, validPoints, sen, pettitt } = forensics;
    const labels = validPoints.map(p => p.date);
    const unit = meta.unit || '';

    // Update chart header labels
    const titleEl = document.getElementById('chartTitle');
    const subEl = document.getElementById('chartSubtitle');
    if (titleEl) titleEl.textContent = `${dataset.name || dataset.title} — ${meta.label}`;
    if (subEl) subEl.textContent = `Observational Range: ${validPoints[0].date} to ${validPoints[validPoints.length - 1].date} (${validPoints.length} points)`;

    // 1. Raw Observations dataset
    const rawData = validPoints.map(p => p.value);

    // 2. Deseasonalized / 12-Month Rolling Average dataset
    // Align with labels length
    const workingDataMap = new Map(workingPoints.map(p => [p.date, p.value]));
    const trendData = labels.map(lbl => workingDataMap.has(lbl) ? workingDataMap.get(lbl) : null);

    // 3. Linear Trendline points (Sen's Slope)
    const slopeLineData = validPoints.map(p => {
      return sen.medianIntercept + sen.slope * p.x;
    });

    const datasets = [
      {
        label: `Raw Monthly ${meta.label}`,
        data: rawData,
        borderColor: 'rgba(148, 163, 184, 0.25)',
        backgroundColor: 'transparent',
        borderWidth: 1,
        pointRadius: 0,
        pointHoverRadius: 3,
        tension: 0.1,
        order: 3
      },
      {
        label: state.deseasonalize ? '12-Month Rolling Trend' : 'Analyzed Trajectory',
        data: trendData,
        borderColor: '#38BDF8',
        backgroundColor: 'rgba(56, 189, 248, 0.05)',
        fill: true,
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.2,
        order: 1
      },
      {
        label: `Sen's Trendline (${sen.slopePerDecade >= 0 ? '+' : ''}${sen.slopePerDecade.toFixed(2)} ${unit}/dec)`,
        data: slopeLineData,
        borderColor: 'rgba(251, 113, 133, 0.85)',
        borderDash: [5, 5],
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        order: 2
      }
    ];

    // 4. Vertical Changepoint Line (built using a sparse dataset with vertical bar/line or annotation)
    if (pettitt && pettitt.changepointLabel) {
      const cpIndex = labels.indexOf(pettitt.changepointLabel);
      if (cpIndex !== -1) {
        // Find y min and max to draw vertical dashed line
        const allVals = validPoints.map(p => p.value).filter(v => !isNaN(v));
        const minY = Math.min(...allVals);
        const maxY = Math.max(...allVals);

        const cpData = labels.map((lbl, idx) => (idx === cpIndex ? maxY : null));
        datasets.push({
          label: `Changepoint (${pettitt.changepointLabel})`,
          data: cpData,
          type: 'bar',
          backgroundColor: 'rgba(251, 191, 36, 0.75)',
          borderColor: '#FBBF24',
          borderWidth: 2,
          barThickness: 2,
          order: 0
        });
      }
    }

    state.chart.data.labels = labels;
    state.chart.data.datasets = datasets;
    state.chart.options.scales.y.title = {
      display: true,
      text: `${meta.label} (${unit})`,
      color: '#94A3B8',
      font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' }
    };

    state.chart.update();
  }

  /**
   * "Compare Opposite Regions" Mode Controller
   */
  async function toggleCompareMode() {
    state.isCompareMode = !state.isCompareMode;
    const btn = document.getElementById('btnCompareToggle');
    const container = document.getElementById('compareContainer');
    const normalVerdict = document.getElementById('verdictCard');

    if (btn) btn.classList.toggle('active', state.isCompareMode);
    if (container) container.classList.toggle('active', state.isCompareMode);

    if (state.isCompareMode) {
      showToast('Entering Compare Opposite Regions Forensic Mode');
      await setupComparePair(state.comparePairId);
    } else {
      showToast('Exited Compare Mode');
      // Clear compare markers
      clearCompareMarkers();
      updateAppUI();
    }
  }

  /**
   * Setup Opposite Pair Data & Comparative Forensics
   */
  async function setupComparePair(pairId) {
    state.comparePairId = pairId;
    const pair = WizardModule.OPPOSITE_PAIRS.find(p => p.id === pairId) || WizardModule.OPPOSITE_PAIRS[0];

    const caseA = DataLoader.CASE_FILES.find(c => c.id === pair.regionA.id);
    const caseB = DataLoader.CASE_FILES.find(c => c.id === pair.regionB.id);

    if (!caseA || !caseB) return;

    showToast(`Loading comparative telemetry: ${caseA.name} vs. ${caseB.name}...`);

    try {
      state.compareDatasetA = await DataLoader.loadCaseFile(caseA);
      state.compareDatasetB = await DataLoader.loadCaseFile(caseB);

      // Render Map Markers for both regions
      renderCompareMapMarkers(state.compareDatasetA, state.compareDatasetB);

      // Fit map bounds to show both regions
      const bounds = L.latLngBounds(
        [state.compareDatasetA.lat, state.compareDatasetA.lon],
        [state.compareDatasetB.lat, state.compareDatasetB.lon]
      );
      state.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 5 });

      renderCompareMode();
    } catch (err) {
      console.error('Failed to load compare pair:', err);
      showToast(`Error setting up compare pair: ${err.message}`, 'error');
    }
  }

  function clearCompareMarkers() {
    state.compareMarkers.forEach(m => state.map.removeLayer(m));
    state.compareMarkers = [];
  }

  function renderCompareMapMarkers(dataA, dataB) {
    clearCompareMarkers();
    if (state.activeMarker) {
      state.map.removeLayer(state.activeMarker);
    }

    const iconA = L.divIcon({
      className: 'radar-pin-container',
      html: '<div class="radar-pin-core" style="background:#38BDF8;box-shadow:0 0 12px #38BDF8;"></div><div class="radar-pin-ring" style="border-color:#38BDF8;"></div>',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const iconB = L.divIcon({
      className: 'radar-pin-container',
      html: '<div class="radar-pin-core" style="background:#FB7185;box-shadow:0 0 12px #FB7185;"></div><div class="radar-pin-ring" style="border-color:#FB7185;"></div>',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const markerA = L.marker([dataA.lat, dataA.lon], { icon: iconA })
      .addTo(state.map)
      .bindPopup(`<strong>${dataA.name}</strong><br>Region A`);

    const markerB = L.marker([dataB.lat, dataB.lon], { icon: iconB })
      .addTo(state.map)
      .bindPopup(`<strong>${dataB.name}</strong><br>Region B`);

    state.compareMarkers.push(markerA, markerB);
  }

  /**
   * Render Compare Mode Visualizations & Forensics
   */
  function renderCompareMode() {
    if (!state.compareDatasetA || !state.compareDatasetB) return;

    const pair = WizardModule.OPPOSITE_PAIRS.find(p => p.id === state.comparePairId);
    const param = pair.variable || 'T2M';
    state.selectedParam = param;
    const meta = DataLoader.getVariableMeta(param);

    const seriesA = state.compareDatasetA.series[param] || [];
    const seriesB = state.compareDatasetB.series[param] || [];

    const forensicsA = ForensicsEngine.analyzeSeries(seriesA, meta, 'rolling12');
    const forensicsB = ForensicsEngine.analyzeSeries(seriesB, meta, 'rolling12');

    if (!forensicsA || !forensicsB) return;

    // Cross-correlation
    const correlation = WizardModule.calculateCorrelation(forensicsA.workingPoints, forensicsB.workingPoints);

    // Update Comparison Insight Card
    const insightCard = document.getElementById('compareInsightCard');
    if (insightCard) {
      insightCard.innerHTML = `
        <div style="font-size:0.9rem;font-weight:700;color:#F8FAFC;margin-bottom:0.4rem;">
          ${pair.title}
        </div>
        <p style="margin-bottom:0.5rem;">${pair.description}</p>
        <p><strong>Forensic Insight:</strong> ${pair.forensicInsight}</p>
        <div style="margin-top:0.6rem;display:flex;gap:1.5rem;font-family:var(--font-mono);font-size:0.75rem;">
          <span>${state.compareDatasetA.name} Slope: <strong style="color:#38BDF8;">${forensicsA.sen.slopePerDecade >= 0 ? '+' : ''}${forensicsA.sen.slopePerDecade.toFixed(3)} ${meta.unit}/dec</strong></span>
          <span>${state.compareDatasetB.name} Slope: <strong style="color:#FB7185;">${forensicsB.sen.slopePerDecade >= 0 ? '+' : ''}${forensicsB.sen.slopePerDecade.toFixed(3)} ${meta.unit}/dec</strong></span>
          <span>Cross-Correlation (r): <strong>${correlation.toFixed(3)}</strong></span>
        </div>
      `;
    }

    // Update KPI Cards using Regional Contrast
    const kpiSlopeVal = document.getElementById('kpiSlopeValue');
    const kpiSlopeSub = document.getElementById('kpiSlopeSub');
    if (kpiSlopeVal) kpiSlopeVal.textContent = `Δ ${(forensicsA.sen.slopePerDecade - forensicsB.sen.slopePerDecade).toFixed(2)}`;
    if (kpiSlopeSub) kpiSlopeSub.textContent = `Decadal Rate Asymmetry`;

    const kpiMKVal = document.getElementById('kpiMKValue');
    const kpiMKSub = document.getElementById('kpiMKSub');
    if (kpiMKVal) kpiMKVal.textContent = `r = ${correlation.toFixed(2)}`;
    if (kpiMKSub) kpiMKSub.textContent = correlation < 0 ? 'Negative Covariance' : 'Positive Covariance';

    // Update Chart with Dual Comparative Series
    renderCompareChart(forensicsA, forensicsB, state.compareDatasetA, state.compareDatasetB, meta);
  }

  function renderCompareChart(forensicsA, forensicsB, dataA, dataB, meta) {
    if (!state.chart) return;

    const labels = forensicsA.validPoints.map(p => p.date);
    const mapB = new Map(forensicsB.workingPoints.map(p => [p.date, p.value]));
    const dataBValues = labels.map(lbl => mapB.has(lbl) ? mapB.get(lbl) : null);

    const mapA = new Map(forensicsA.workingPoints.map(p => [p.date, p.value]));
    const dataAValues = labels.map(lbl => mapA.has(lbl) ? mapA.get(lbl) : null);

    // Update Chart header
    const titleEl = document.getElementById('chartTitle');
    const subEl = document.getElementById('chartSubtitle');
    if (titleEl) titleEl.textContent = `Comparative Telemetry: ${dataA.name} vs. ${dataB.name}`;
    if (subEl) subEl.textContent = `Variable: ${meta.label} (${meta.unit}) | Synchronized 12-Month Deseasonalized Trends`;

    state.chart.data.labels = labels;
    state.chart.data.datasets = [
      {
        label: `${dataA.name} (${forensicsA.sen.slopePerDecade >= 0 ? '+' : ''}${forensicsA.sen.slopePerDecade.toFixed(2)}/dec)`,
        data: dataAValues,
        borderColor: '#38BDF8',
        backgroundColor: 'rgba(56, 189, 248, 0.08)',
        fill: true,
        borderWidth: 2.5,
        pointRadius: 0,
        tension: 0.2
      },
      {
        label: `${dataB.name} (${forensicsB.sen.slopePerDecade >= 0 ? '+' : ''}${forensicsB.sen.slopePerDecade.toFixed(2)}/dec)`,
        data: dataBValues,
        borderColor: '#FB7185',
        backgroundColor: 'rgba(251, 113, 133, 0.08)',
        fill: true,
        borderWidth: 2.5,
        pointRadius: 0,
        tension: 0.2
      }
    ];

    state.chart.update();
  }

  /**
   * Investigation Wizard Modal Flow
   */
  function setupWizard() {
    let currentStep = 1;
    let selectedScenario = WizardModule.WIZARD_SCENARIOS[0];

    const stepNodes = document.querySelectorAll('.wizard-step-node');
    const stepContents = document.querySelectorAll('.wizard-step-content');
    const btnNext = document.getElementById('wizardBtnNext');
    const btnBack = document.getElementById('wizardBtnBack');
    const btnLaunch = document.getElementById('wizardBtnLaunch');

    function updateStepUI() {
      stepNodes.forEach((node, idx) => {
        const stepNum = idx + 1;
        node.classList.toggle('active', stepNum === currentStep);
        node.classList.toggle('completed', stepNum < currentStep);
      });

      stepContents.forEach((content, idx) => {
        content.style.display = (idx + 1 === currentStep) ? 'flex' : 'none';
      });

      if (btnBack) btnBack.style.display = currentStep > 1 ? 'inline-flex' : 'none';
      if (btnNext) btnNext.style.display = currentStep < 3 ? 'inline-flex' : 'none';
      if (btnLaunch) btnLaunch.style.display = currentStep === 3 ? 'inline-flex' : 'none';

      if (currentStep === 3) {
        renderWizardStep3Summary(selectedScenario);
      }
    }

    // Step 1 Options Render
    const optionsContainer = document.getElementById('wizardStep1Options');
    if (optionsContainer) {
      optionsContainer.innerHTML = '';
      WizardModule.WIZARD_SCENARIOS.forEach((sc, idx) => {
        const opt = document.createElement('div');
        opt.className = `wizard-option-card ${idx === 0 ? 'selected' : ''}`;
        opt.innerHTML = `
          <div class="wizard-option-header">
            <span>${sc.ecosystemIcon}</span>
            <span>${sc.ecosystem}</span>
          </div>
          <div class="wizard-option-desc">${sc.shift}</div>
        `;
        opt.addEventListener('click', () => {
          optionsContainer.querySelectorAll('.wizard-option-card').forEach(c => c.classList.remove('selected'));
          opt.classList.add('selected');
          selectedScenario = sc;
        });
        optionsContainer.appendChild(opt);
      });
    }

    // Step 2 Options Render
    const step2Container = document.getElementById('wizardStep2Options');
    if (step2Container) {
      step2Container.innerHTML = '';
      WizardModule.WIZARD_SCENARIOS.forEach((sc, idx) => {
        const opt = document.createElement('div');
        opt.className = `wizard-option-card ${idx === 0 ? 'selected' : ''}`;
        opt.innerHTML = `
          <div class="wizard-option-header">
            <span>🎯</span>
            <span>${sc.shift}</span>
          </div>
          <div class="wizard-option-desc">${sc.shiftDescription}</div>
        `;
        opt.addEventListener('click', () => {
          step2Container.querySelectorAll('.wizard-option-card').forEach(c => c.classList.remove('selected'));
          opt.classList.add('selected');
          selectedScenario = sc;
        });
        step2Container.appendChild(opt);
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (currentStep < 3) {
          currentStep++;
          updateStepUI();
        }
      });
    }

    if (btnBack) {
      btnBack.addEventListener('click', () => {
        if (currentStep > 1) {
          currentStep--;
          updateStepUI();
        }
      });
    }

    if (btnLaunch) {
      btnLaunch.addEventListener('click', async () => {
        closeModal('wizardModal');
        // If in compare mode, turn off
        if (state.isCompareMode) toggleCompareMode();

        showToast(`Launching investigation: ${selectedScenario.title}`);
        await selectCaseFile(selectedScenario.targetCaseId);

        if (selectedScenario.targetVariable) {
          state.selectedParam = selectedScenario.targetVariable;
          updateVariableSelectorUI();
          updateAppUI();
        }
      });
    }

    function renderWizardStep3Summary(scenario) {
      const summaryEl = document.getElementById('wizardStep3Summary');
      if (!summaryEl) return;
      const meta = DataLoader.getVariableMeta(scenario.targetVariable);

      summaryEl.innerHTML = `
        <div style="background:rgba(11,17,32,0.8);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:1.2rem;display:flex;flex-direction:column;gap:0.75rem;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:1.1rem;font-weight:800;color:#F8FAFC;">${scenario.title}</span>
            <span class="mission-badge">${meta.mission}</span>
          </div>
          <p style="font-size:0.8rem;color:var(--text-secondary);line-height:1.45;">${scenario.shiftDescription}</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;font-family:var(--font-mono);font-size:0.75rem;padding:0.75rem;background:rgba(0,0,0,0.3);border-radius:var(--radius-sm);">
            <div>Target Coordinates: <span style="color:#38BDF8;">${scenario.lat}°, ${scenario.lon}°</span></div>
            <div>Target Variable: <span style="color:#FB7185;">${meta.label}</span></div>
          </div>
          <div style="font-size:0.75rem;color:var(--text-muted);">
            <strong>Expected Detection:</strong> ${scenario.expectedOutcome}
          </div>
        </div>
      `;
    }

    updateStepUI();
  }

  /**
   * Drag & Drop File Upload Handler
   */
  function setupDropzone() {
    const dropzone = document.getElementById('csvDropzone');
    const fileInput = document.getElementById('csvFileInput');

    if (!dropzone || !fileInput) return;

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) processUploadedFile(files[0]);
    });

    dropzone.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) processUploadedFile(fileInput.files[0]);
    });
  }

  function processUploadedFile(file) {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      showToast('Please upload a valid .csv or .txt file', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsed = text.includes('-BEGIN HEADER-')
          ? DataLoader.parsePowerCSV(text, file.name)
          : DataLoader.parseGenericCSV(text, file.name);

        state.currentDataset = parsed;
        state.selectedParam = parsed.parameters[0];

        closeModal('uploadModal');
        showToast(`Successfully parsed ${file.name} (${parsed.parameters.length} parameters)`, 'success');

        // Center map if coordinates found
        if (parsed.lat !== 0 || parsed.lon !== 0) {
          state.map.flyTo([parsed.lat, parsed.lon], 4);
          setMapPin(parsed.lat, parsed.lon, parsed.title);
        }

        updateVariableSelectorUI();
        updateAppUI();
      } catch (err) {
        console.error('File parse error:', err);
        showToast(`CSV Parse Error: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
  }

  /**
   * Event Listeners Registration
   */
  function setupEventListeners() {
    // Deseasonalize toggle
    const deseasonSwitch = document.getElementById('toggleDeseasonalize');
    if (deseasonSwitch) {
      deseasonSwitch.addEventListener('click', () => {
        state.deseasonalize = !state.deseasonalize;
        deseasonSwitch.classList.toggle('active', state.deseasonalize);
        updateAppUI();
      });
    }

    // Time window chips
    document.querySelectorAll('.time-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.time-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.timeWindow = chip.dataset.range;
        updateAppUI();
      });
    });

    // Navigation buttons
    const btnWizard = document.getElementById('btnOpenWizard');
    if (btnWizard) {
      btnWizard.addEventListener('click', () => {
        openModal('wizardModal');
      });
    }

    const btnCompare = document.getElementById('btnCompareToggle');
    if (btnCompare) {
      btnCompare.addEventListener('click', () => {
        toggleCompareMode();
      });
    }

    const btnSources = document.getElementById('btnOpenDataSources');
    if (btnSources) {
      btnSources.addEventListener('click', () => {
        openModal('sourcesModal');
      });
    }

    // Compare pair selector buttons
    document.querySelectorAll('.compare-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.compare-preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        setupComparePair(btn.dataset.pair);
      });
    });

    // Export CSV Button
    const btnExportCSV = document.getElementById('btnExportCSV');
    if (btnExportCSV) {
      btnExportCSV.addEventListener('click', () => exportDataCSV());
    }

    // Export PNG Button
    const btnExportPNG = document.getElementById('btnExportPNG');
    if (btnExportPNG) {
      btnExportPNG.addEventListener('click', () => exportChartPNG());
    }
  }

  /**
   * Export Current Data as CSV
   */
  function exportDataCSV() {
    if (!state.currentDataset || !state.selectedParam) return;
    const series = state.currentDataset.series[state.selectedParam];
    if (!series) return;

    let csvContent = 'data:text/csv;charset=utf-8,Date,Year,Month,' + state.selectedParam + '\n';
    series.forEach(p => {
      csvContent += `${p.date},${p.year},${p.month},${p.value}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TerraSleuth_${state.selectedParam}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported time series to CSV', 'success');
  }

  /**
   * Export Chart Canvas as PNG Image
   */
  function exportChartPNG() {
    if (!state.chart) return;
    const url = state.chart.toBase64Image();
    const link = document.createElement('a');
    link.download = `TerraSleuth_Forensics_${Date.now()}.png`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Chart snapshot exported to PNG', 'success');
  }

  /**
   * Modal Management
   */
  function setupModals() {
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-backdrop');
        if (modal) modal.classList.remove('open');
      });
    });

    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('open');
      });
    });

    setupWizard();
  }

  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('open');
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('open');
  }

  /**
   * Toast Notification Helper
   */
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : ''}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✓' : type === 'error' ? '⚠' : 'ℹ'}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  /**
   * Live API Loading State
   */
  function setLiveLoadingState(isLoading) {
    state.isFetchingLive = isLoading;
    const dot = document.getElementById('liveStatusDot');
    const text = document.getElementById('liveStatusText');

    if (dot) dot.classList.toggle('loading', isLoading);
    if (text) text.textContent = isLoading ? 'FETCHING NASA DATA...' : 'NASA API: READY';
  }

  return {
    init,
    selectCaseFile,
    handleMapPointDrop,
    toggleCompareMode
  };

})();
