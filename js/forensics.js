/**
 * TerraSleuth — Earth System Trend Detective
 * Statistical Forensics Engine (Pure JavaScript)
 * 
 * Implements:
 * - Sen's Slope (Theil-Sen Robust Estimator) & OLS Linear Slope
 * - Mann-Kendall Trend Test with Tie Corrections & Exact p-value
 * - 95% Confidence Interval calculation
 * - Pettitt's Non-Parametric Changepoint Detection
 * - 12-Month Rolling Deseasonalization & Climatology Anomalies
 * - Plain-English Detective Verdict Synthesis
 */

const ForensicsEngine = (() => {

  /**
   * Standard Normal Cumulative Distribution Function (Abramowitz & Stegun 7.1.26)
   * Absolute error < 1.5e-7
   */
  function normalCDF(z) {
    if (isNaN(z)) return 0.5;
    const absZ = Math.abs(z);
    const t = 1.0 / (1.0 + 0.2316419 * absZ);
    const d = 0.3989422804014327 * Math.exp(-0.5 * absZ * absZ);
    const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return z > 0 ? 1.0 - p : p;
  }

  /**
   * Rational approximation of inverse standard normal CDF (Acklam's algorithm)
   */
  function normalInv(p) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    if (p === 0.5) return 0;

    const a1 = -3.969683028665376e+01, a2 = 2.209460984245205e+02, a3 = -2.759285104469687e+02;
    const a4 = 1.383577518672690e+02, a5 = -3.066479806614716e+01, a6 = 2.506628277459239e+00;
    const b1 = -5.447609879822406e+01, b2 = 1.615858368580409e+02, b3 = -1.556989798598866e+02;
    const b4 = 6.680131188771972e+01, b5 = -1.328068155288572e+01;
    const c1 = -7.784894002430293e-03, c2 = -3.223964580411365e-01, c3 = -2.400758277161838e+00;
    const c4 = -2.549732539343734e+00, c5 = 4.374664141464968e+00, c6 = 2.938163982698783e+00;
    const d1 = 7.784695709041462e-03, d2 = 3.224671290700398e-01, d3 = 2.445134137142996e+00;
    const d4 = 3.754408661907416e+00;

    const pLow = 0.02425;
    const pHigh = 1 - pLow;
    let q, r;

    if (p < pLow) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
             ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
    }
    if (p <= pHigh) {
      q = p - 0.5;
      r = q * q;
      return (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
             (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
    }
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
            ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
  }

  /**
   * Ordinary Least Squares linear regression
   */
  function linearRegression(points) {
    const n = points.length;
    if (n < 2) return { slope: 0, intercept: 0, r2: 0, stdErr: 0 };

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (let i = 0; i < n; i++) {
      const x = points[i].x;
      const y = points[i].y;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
      sumY2 += y * y;
    }

    const denom = n * sumX2 - sumX * sumX;
    if (Math.abs(denom) < 1e-12) return { slope: 0, intercept: sumY / n, r2: 0, stdErr: 0 };

    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;

    // R-squared and standard error
    const meanY = sumY / n;
    let ssTot = 0, ssRes = 0;
    for (let i = 0; i < n; i++) {
      const y = points[i].y;
      const yPred = slope * points[i].x + intercept;
      ssTot += (y - meanY) * (y - meanY);
      ssRes += (y - yPred) * (y - yPred);
    }
    const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
    const stdErr = n > 2 ? Math.sqrt(ssRes / (n - 2) / (sumX2 - (sumX * sumX) / n)) : 0;

    return { slope, intercept, r2, stdErr };
  }

  /**
   * Mann-Kendall Non-Parametric Trend Test
   * Computes S, Var(S) with tie adjustments, Z, and two-tailed p-value
   */
  function mannKendallTest(values) {
    const n = values.length;
    if (n < 4) {
      return { s: 0, varS: 1, z: 0, pVal: 1, isSignificant: false, trend: 'insufficient_data' };
    }

    let s = 0;
    for (let i = 0; i < n - 1; i++) {
      const vi = values[i];
      for (let j = i + 1; j < n; j++) {
        const diff = values[j] - vi;
        if (diff > 0) s += 1;
        else if (diff < 0) s -= 1;
      }
    }

    // Tie correction
    const counts = {};
    for (let i = 0; i < n; i++) {
      const rounded = Math.round(values[i] * 1000) / 1000;
      counts[rounded] = (counts[rounded] || 0) + 1;
    }
    let tieSum = 0;
    for (const key in counts) {
      const t = counts[key];
      if (t > 1) {
        tieSum += t * (t - 1) * (2 * t + 5);
      }
    }

    const varS = (n * (n - 1) * (2 * n + 5) - tieSum) / 18;
    const stdS = Math.sqrt(varS);

    let z = 0;
    if (s > 0) {
      z = (s - 1) / stdS;
    } else if (s < 0) {
      z = (s + 1) / stdS;
    }

    const pVal = 2 * (1 - normalCDF(Math.abs(z)));
    const isSignificant = pVal < 0.05;

    let trend = 'stable';
    if (isSignificant) {
      trend = s > 0 ? 'increasing' : 'decreasing';
    } else if (Math.abs(z) > 1.28) { // p < 0.20
      trend = s > 0 ? 'weak_increasing' : 'weak_decreasing';
    }

    return { s, varS, stdS, z, pVal, isSignificant, trend };
  }

  /**
   * Sen's Slope (Theil-Sen Estimator) with 95% Confidence Interval
   * points: [{ x: years, y: value }]
   * Returns slope per unit X (typically years) and decade slope (* 10)
   */
  function sensSlope(points, mkResult) {
    const n = points.length;
    if (n < 2) {
      return {
        slope: 0,
        slopePerDecade: 0,
        ciLower: 0,
        ciUpper: 0,
        ciLowerDecade: 0,
        ciUpperDecade: 0,
        medianIntercept: 0
      };
    }

    // Calculate all pairwise slopes
    // For n up to 600, pairwise slopes = 180,000 floats (very fast in modern JS V8)
    const slopes = [];
    for (let i = 0; i < n - 1; i++) {
      const xi = points[i].x;
      const yi = points[i].y;
      for (let j = i + 1; j < n; j++) {
        const dx = points[j].x - xi;
        if (Math.abs(dx) > 1e-7) {
          slopes.push((points[j].y - yi) / dx);
        }
      }
    }

    slopes.sort((a, b) => a - b);
    const N = slopes.length;
    if (N === 0) return { slope: 0, slopePerDecade: 0, ciLower: 0, ciUpper: 0, ciLowerDecade: 0, ciUpperDecade: 0, medianIntercept: 0 };

    const medianSlope = N % 2 === 1
      ? slopes[Math.floor(N / 2)]
      : (slopes[N / 2 - 1] + slopes[N / 2]) / 2;

    // 95% Confidence Interval using Mann-Kendall Variance
    const z95 = 1.95996398454;
    const stdS = (mkResult && mkResult.stdS) ? mkResult.stdS : Math.sqrt((n * (n - 1) * (2 * n + 5)) / 18);
    const Calpha = z95 * stdS;

    const m1 = Math.max(0, Math.floor((N - Calpha) / 2));
    const m2 = Math.min(N - 1, Math.ceil((N + Calpha) / 2));

    const ciLower = slopes[m1];
    const ciUpper = slopes[m2];

    // Median intercept
    const intercepts = points.map(p => p.y - medianSlope * p.x);
    intercepts.sort((a, b) => a - b);
    const medianIntercept = intercepts[Math.floor(intercepts.length / 2)];

    return {
      slope: medianSlope,
      slopePerDecade: medianSlope * 10,
      ciLower,
      ciUpper,
      ciLowerDecade: ciLower * 10,
      ciUpperDecade: ciUpper * 10,
      medianIntercept
    };
  }

  /**
   * Pettitt's Non-Parametric Single Changepoint Test
   * Detects the exact point in time where a regime shift or abrupt break occurred
   */
  function pettittTest(values, timeLabels) {
    const n = values.length;
    if (n < 6) {
      return { changepointIndex: -1, changepointLabel: 'N/A', pVal: 1, isSignificant: false, meanBefore: 0, meanAfter: 0, shiftDelta: 0 };
    }

    // Rank values (handling ties with average rank)
    const indexed = values.map((v, i) => ({ v, i }));
    indexed.sort((a, b) => a.v - b.v);

    const ranks = new Array(n);
    let i = 0;
    while (i < n) {
      let j = i;
      while (j < n - 1 && Math.abs(indexed[j + 1].v - indexed[i].v) < 1e-7) {
        j++;
      }
      const avgRank = (i + j + 2) / 2; // ranks are 1-based
      for (let k = i; k <= j; k++) {
        ranks[indexed[k].i] = avgRank;
      }
      i = j + 1;
    }

    let runningRankSum = 0;
    let maxAbsU = -1;
    let changepointIndex = 0;
    let bestU = 0;

    for (let t = 1; t < n; t++) {
      runningRankSum += ranks[t - 1];
      const ut = 2 * runningRankSum - t * (n + 1);
      const absUt = Math.abs(ut);
      if (absUt > maxAbsU) {
        maxAbsU = absUt;
        bestU = ut;
        changepointIndex = t - 1; // 0-based index of changepoint
      }
    }

    const k = maxAbsU;
    const pVal = Math.min(1.0, 2 * Math.exp((-6 * k * k) / (Math.pow(n, 3) + Math.pow(n, 2))));
    const isSignificant = pVal < 0.05;

    // Calculate mean before and after changepoint
    let sumBefore = 0, sumAfter = 0;
    for (let idx = 0; idx <= changepointIndex; idx++) sumBefore += values[idx];
    for (let idx = changepointIndex + 1; idx < n; idx++) sumAfter += values[idx];

    const countBefore = changepointIndex + 1;
    const countAfter = n - countBefore;

    const meanBefore = sumBefore / countBefore;
    const meanAfter = countAfter > 0 ? sumAfter / countAfter : meanBefore;
    const shiftDelta = meanAfter - meanBefore;

    const changepointLabel = (timeLabels && timeLabels[changepointIndex])
      ? timeLabels[changepointIndex]
      : `Index ${changepointIndex}`;

    return {
      changepointIndex,
      changepointLabel,
      uStatistic: bestU,
      maxAbsU,
      pVal,
      isSignificant,
      meanBefore,
      meanAfter,
      shiftDelta
    };
  }

  /**
   * 12-Month Trailing Rolling Average
   * Preserves exact date matching for monthly datasets
   */
  function rollingAverage12(points) {
    const result = [];
    const windowSize = 12;

    for (let i = 0; i < points.length; i++) {
      if (i < windowSize - 1) {
        // Not enough history for full 12-month window
        result.push({
          date: points[i].date,
          x: points[i].x,
          value: null // or partial average
        });
      } else {
        let sum = 0;
        for (let k = 0; k < windowSize; k++) {
          sum += points[i - k].value;
        }
        result.push({
          date: points[i].date,
          x: points[i].x,
          value: sum / windowSize
        });
      }
    }
    return result;
  }

  /**
   * Deseasonalize by subtracting 12-month climatological baseline (Monthly Anomaly)
   */
  function deseasonalizeAnomalies(points) {
    if (points.length < 12) return points;

    // Calculate climatological mean for each of the 12 calendar months (0..11)
    const monthSums = new Array(12).fill(0);
    const monthCounts = new Array(12).fill(0);

    for (let i = 0; i < points.length; i++) {
      const monthIdx = points[i].month ? points[i].month - 1 : (i % 12);
      monthSums[monthIdx] += points[i].value;
      monthCounts[monthIdx]++;
    }

    const monthMeans = monthSums.map((s, idx) => (monthCounts[idx] > 0 ? s / monthCounts[idx] : 0));

    return points.map((p, i) => {
      const monthIdx = p.month ? p.month - 1 : (i % 12);
      return {
        ...p,
        raw: p.value,
        climatology: monthMeans[monthIdx],
        value: p.value - monthMeans[monthIdx]
      };
    });
  }

  /**
   * Comprehensive Forensics Analysis Runner
   * Takes clean series points: [{ date: '1995-01', x: 1995.0, year: 1995, month: 1, value: 26.2 }]
   */
  function analyzeSeries(rawPoints, variableMeta, deseasonalizeMode = 'rolling12') {
    if (!rawPoints || rawPoints.length < 4) {
      return null;
    }

    // Filter out any invalid numbers
    const validPoints = rawPoints.filter(p => !isNaN(p.value) && p.value !== -999 && p.value > -900);
    if (validPoints.length < 4) return null;

    // Generate working points based on deseasonalize mode
    let workingPoints = [];
    if (deseasonalizeMode === 'rolling12') {
      const rolling = rollingAverage12(validPoints);
      workingPoints = rolling.filter(p => p.value !== null);
    } else if (deseasonalizeMode === 'anomaly') {
      workingPoints = deseasonalizeAnomalies(validPoints);
    } else {
      workingPoints = validPoints;
    }

    const values = workingPoints.map(p => p.value);
    const timeLabels = workingPoints.map(p => p.date);
    const regressionInput = workingPoints.map(p => ({ x: p.x, y: p.value }));

    // 1. Mann-Kendall Test
    const mk = mannKendallTest(values);

    // 2. Sen's Slope & CI
    const sen = sensSlope(regressionInput, mk);

    // 3. Linear Regression (OLS)
    const ols = linearRegression(regressionInput);

    // 4. Pettitt Changepoint Test
    const pettitt = pettittTest(values, timeLabels);

    // 5. Generate Plain-English Detective Verdict
    const verdict = generateDetectiveVerdict({
      mk,
      sen,
      ols,
      pettitt,
      count: values.length,
      startYear: validPoints[0].year,
      endYear: validPoints[validPoints.length - 1].year,
      variableMeta,
      deseasonalizeMode
    });

    return {
      mk,
      sen,
      ols,
      pettitt,
      verdict,
      workingPoints,
      validPoints,
      deseasonalizeMode
    };
  }

  /**
   * Plain-English Detective Verdict Narrative Generator
   */
  function generateDetectiveVerdict(stats) {
    const { mk, sen, ols, pettitt, count, startYear, endYear, variableMeta, deseasonalizeMode } = stats;
    const vName = variableMeta?.label || 'Earth Observation Variable';
    const vUnit = variableMeta?.unit || '';
    const vId = variableMeta?.id || '';

    const isSig = mk.isSignificant;
    const slopeDecade = sen.slopePerDecade;
    const absSlope = Math.abs(slopeDecade);
    const isWarmingOrRising = slopeDecade > 0;
    const formattedSlope = `${slopeDecade >= 0 ? '+' : ''}${slopeDecade.toFixed(3)} ${vUnit}/decade`;

    // Extract changepoint year
    const cpDate = pettitt.changepointLabel;
    const cpYear = cpDate.includes('-') ? cpDate.split('-')[0] : cpDate;
    const shiftDeltaFormatted = `${pettitt.shiftDelta >= 0 ? '+' : ''}${pettitt.shiftDelta.toFixed(2)} ${vUnit}`;

    // Confidence Level percentage
    const confidencePct = Math.max(0, Math.min(99.99, (1 - mk.pVal) * 100)).toFixed(2);

    let statusTitle = '';
    let statusClass = '';
    let summaryText = '';
    let ecologicalContext = '';

    if (isSig) {
      statusTitle = 'STATISTICALLY SIGNIFICANT TREND DETECTED (p < 0.05)';
      statusClass = 'verdict-significant';

      const directionWord = isWarmingOrRising ? 'upward escalation' : 'persistent decline';

      summaryText = `Between <strong>${startYear}</strong> and <strong>${endYear}</strong> (${count} months analyzed), ${vName} underwent a statistically verified ${directionWord} at a rate of <strong>${formattedSlope}</strong> (Sen's Slope, 95% CI [${sen.ciLowerDecade.toFixed(3)}, ${sen.ciUpperDecade.toFixed(3)}]). The Mann-Kendall test confirms this signal is not random noise (Z = ${mk.z.toFixed(2)}, p = ${mk.pVal < 0.0001 ? '< 0.0001' : mk.pVal.toFixed(4)}, ${confidencePct}% confidence).`;

      if (pettitt.isSignificant) {
        summaryText += ` A critical Earth System changepoint occurred around <strong>${cpYear}</strong> (${cpDate}), after which the mean shifted by <strong>${shiftDeltaFormatted}</strong>.`;
      }
    } else {
      statusTitle = 'NOT YET STATISTICALLY SIGNIFICANT (p ≥ 0.05)';
      statusClass = 'verdict-not-significant';

      summaryText = `Between <strong>${startYear}</strong> and <strong>${endYear}</strong>, ${vName} shows a slight trajectory of <strong>${formattedSlope}</strong>, but natural interannual climate variability masks a clear trend (Z = ${mk.z.toFixed(2)}, p = ${mk.pVal.toFixed(4)}). A baseline shift was located around ${cpYear} (Δ = ${shiftDeltaFormatted}), but current observational span requires extended monitoring.`;
    }

    // Domain-specific ecological & climate detective context
    if (vId === 'T2M' || vName.toLowerCase().includes('temperature')) {
      if (isWarmingOrRising) {
        ecologicalContext = 'Thermal trajectory intensifies atmospheric vapor pressure deficit, accelerating soil moisture depletion and amplifying wildfire risk and surface evaporative demand.';
      } else {
        ecologicalContext = 'Temperature anomalies exhibit localized thermal buffering, frequently tied to regional ocean upwelling or atmospheric circulation patterns.';
      }
    } else if (vId === 'PRECTOTCORR' || vName.toLowerCase().includes('precip')) {
      if (slopeDecade < -0.05) {
        ecologicalContext = 'Persistent precipitation drop signals intensifying hydrological stress, depleting groundwater reservoirs and accelerating agricultural drought vulnerability.';
      } else if (slopeDecade > 0.05) {
        ecologicalContext = 'Rising rainfall trends indicate heightened atmospheric moisture capacity (Clausius-Clapeyron scaling ~7%/°C), frequently manifesting in extreme convective burst events.';
      } else {
        ecologicalContext = 'Total precipitation remains quasi-stable on multi-decadal aggregates, though sub-seasonal distribution and storm intensity may still experience variance.';
      }
    } else if (vId === 'ALLSKY_SFC_SW_DWN' || vName.toLowerCase().includes('solar')) {
      ecologicalContext = 'Surface downward solar flux alterations reflect changes in regional aerosol optical depth, cloud albedo feedbacks, and tropospheric atmospheric transparency.';
    } else if (vId === 'RH2M' || vName.toLowerCase().includes('humidity')) {
      ecologicalContext = 'Relative humidity trends govern physiological plant transpiration stress, boundary layer dynamics, and dew point temperature stability.';
    } else {
      ecologicalContext = 'Observed parameter variations highlight multi-decadal Earth system rebalancing across biosphere and atmosphere interfaces.';
    }

    return {
      statusTitle,
      statusClass,
      summaryText,
      ecologicalContext,
      formattedSlope,
      confidencePct,
      pValFormatted: mk.pVal < 0.0001 ? '< 0.0001' : mk.pVal.toFixed(4),
      zFormatted: mk.z.toFixed(2),
      changepointYear: cpYear,
      changepointDate: cpDate,
      shiftDeltaFormatted,
      isSignificant: isSig,
      deseasonalizeNote: deseasonalizeMode === 'rolling12'
        ? 'Data filtered with a 12-month rolling average to suppress annual solar seasonality and spotlight multi-decadal shifts.'
        : deseasonalizeMode === 'anomaly'
        ? 'Data represented as monthly climatological anomalies relative to the multi-decadal baseline.'
        : 'Displaying raw monthly values.'
    };
  }

  // Public API
  return {
    normalCDF,
    normalInv,
    linearRegression,
    mannKendallTest,
    sensSlope,
    pettittTest,
    rollingAverage12,
    deseasonalizeAnomalies,
    analyzeSeries,
    generateDetectiveVerdict
  };

})();

// Export for module or browser window
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ForensicsEngine;
}
