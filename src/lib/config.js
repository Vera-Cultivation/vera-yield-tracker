// Wholesale price used to turn dry weight into revenue. Override with VITE_PRICE_PER_GRAM.
export const PRICE_PER_GRAM = Number(import.meta.env.VITE_PRICE_PER_GRAM) || 3.6;

// Targets used when environment_current / rootzone_current leave setpoint, target_low,
// target_high or drift_margin empty. Placeholders: change them to the grow team's numbers.
//   setpoint, targetLow, targetHigh, driftMargin
export const DEFAULT_TARGETS = {
  temp: [78, 72, 82, 3],
  rh: [60, 50, 70, 5],
  co2: [1200, 900, 1400, 150],
  vwc: [null, 35, 60, 5],
  ec: [null, 3, 7, 1],
  rzt: [null, 65, 75, 3],
};
