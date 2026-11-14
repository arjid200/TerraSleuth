/**
 * TerraSleuth — Earth System Trend Detective
 * Investigation Wizard & Opposite Regions Comparison Module
 */

const WizardModule = (() => {

  // Preset investigation scenarios for the 3-step wizard
  const WIZARD_SCENARIOS = [
    {
      id: 'arctic_polar',
      title: 'High Arctic Polar Amplification',
      ecosystem: 'Polar & Cryosphere',
      ecosystemIcon: '❄️',
      shift: 'Rapid Warming Amplification & Ice Retreat',
      shiftDescription: 'Arctic surface temperatures are rising 3x to 4x faster than the global mean due to positive ice-albedo feedbacks.',
      targetCaseId: 'arctic_fram',
      targetVariable: 'T2M',
      lat: 80.00,
      lon: 0.01,
      expectedOutcome: 'Statistically significant warming (>+0.4°C/decade) with winter amplification.'
    },
    {
      id: 'amazon_drought',
      title: 'Amazon Rainforest Hydrological Stress',
      ecosystem: 'Tropical Rainforest',
      ecosystemIcon: '🌳',
      shift: 'Thermal Surge & Precipitation Suppression',
      shiftDescription: 'Compounding deforestation and Atlantic-Pacific SST anomalies driving historic 21st-century droughts.',
      targetCaseId: 'amazon_manaus',
      targetVariable: 'T2M',
      lat: -3.10,
      lon: -60.00,
      expectedOutcome: 'Unambiguous upward temperature trend (p < 0.001) coupled with precipitation deficits.'
    },
    {
      id: 'monsoon_kochi',
      title: 'Tropical Maritime Monsoon Shifting',
      ecosystem: 'Monsoon Tropics',
      ecosystemIcon: '🌊',
      shift: 'Oceanic Warming & Intensified Monsoon Extremes',
      shiftDescription: 'Rapid Indian Ocean warming driving higher moisture carrying capacity and episodic deluge events.',
      targetCaseId: 'monsoon_kochi',
      targetVariable: 'T2M',
      lat: 9.93,
      lon: 76.27,
      expectedOutcome: 'Continuous thermal rise with high variance precipitation spikes.'
    },
    {
      id: 'sahel_rebound',
      title: 'Sahel Savannah Rainfall Rebound',
      ecosystem: 'Semi-Arid Transition',
      ecosystemIcon: '🌾',
      shift: 'Vegetation Greening & Precipitation Recovery',
      shiftDescription: 'Post-1980s recovery of West African monsoon rainfall counteracting historic multi-decadal desiccation.',
      targetCaseId: 'sahel_niamey',
      targetVariable: 'PRECTOTCORR',
      lat: 13.51,
      lon: 2.12,
      expectedOutcome: 'Positive precipitation trajectory contrasting global tropical forest drying.'
    }
  ];

  // Curated Opposite Region pairs demonstrating diverging global responses
  const OPPOSITE_PAIRS = [
    {
      id: 'polar_asymmetry',
      title: 'Polar Asymmetry: High Arctic vs. Continental Antarctica',
      description: 'Why the North Pole is warming at breakneck speed while parts of Antarctica maintain thermal stability.',
      regionA: {
        id: 'arctic_fram',
        name: 'High Arctic (Fram Strait)',
        lat: 80.00,
        lon: 0.01,
        color: '#38BDF8',
        accent: 'cyan'
      },
      regionB: {
        id: 'antarctic_weddell',
        name: 'Weddell Sea Coast (Antarctica)',
        lat: -75.00,
        lon: -40.00,
        color: '#FB7185',
        accent: 'coral'
      },
      variable: 'T2M',
      forensicInsight: 'The Arctic is a frozen ocean surrounded by warming continents, where melting sea ice unmasks dark ocean waters that absorb 90% of solar radiation. In contrast, Antarctica is a massive high-altitude ice plateau isolated by the ferocious Antarctic Circumpolar Current and ozone-recovery circulation buffers.'
    },
    {
      id: 'tropical_divergence',
      title: 'Tropical Divergence: Amazon Drying vs. Sahel Greening',
      description: 'How atmospheric circulation shifts suppress rainfall in the Amazon while reviving the West African Sahel.',
      regionA: {
        id: 'amazon_manaus',
        name: 'Amazon Rainforest (Manaus)',
        lat: -3.10,
        lon: -60.00,
        color: '#FB7185',
        accent: 'coral'
      },
      regionB: {
        id: 'sahel_niamey',
        name: 'Sahel Savannah (Niamey)',
        lat: 13.51,
        lon: 2.12,
        color: '#34D399',
        accent: 'emerald'
      },
      variable: 'PRECTOTCORR',
      forensicInsight: 'Warming Atlantic sea surface temperature gradients displace the Intertropical Convergence Zone (ITCZ) northward, drawing moisture northward into the Sahel while starving the southern Amazon basin of moisture convergence.'
    }
  ];

  /**
   * Pearson correlation coefficient between two equal-length aligned series
   */
  function calculateCorrelation(seriesA, seriesB) {
    // Match by date
    const mapB = new Map(seriesB.map(p => [p.date, p.value]));
    const matched = [];

    for (const p of seriesA) {
      if (mapB.has(p.date)) {
        matched.push({ a: p.value, b: mapB.get(p.date) });
      }
    }

    const n = matched.length;
    if (n < 4) return 0;

    let sumA = 0, sumB = 0;
    for (let i = 0; i < n; i++) {
      sumA += matched[i].a;
      sumB += matched[i].b;
    }
    const meanA = sumA / n;
    const meanB = sumB / n;

    let num = 0, denA = 0, denB = 0;
    for (let i = 0; i < n; i++) {
      const da = matched[i].a - meanA;
      const db = matched[i].b - meanB;
      num += da * db;
      denA += da * da;
      denB += db * db;
    }

    const den = Math.sqrt(denA * denB);
    return den === 0 ? 0 : num / den;
  }

  return {
    WIZARD_SCENARIOS,
    OPPOSITE_PAIRS,
    calculateCorrelation
  };

})();

// Export for module or browser window
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WizardModule;
}
