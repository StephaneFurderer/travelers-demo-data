// GLM coefficients mirrored from travel_portfolio_generator/config.py
// Pure premium = frequency x E[severity]

// ---------------------------------------------------------------------------
// Raw coefficient dictionaries
// ---------------------------------------------------------------------------

export const FREQ_GLM = {
  intercept: -4.5,
  age: 0.02, // per unit of (age - 40) / 10
  log_trip_cost: 0.15,
  product_flight: 0.25,
  segment_holiday: 0.55,
  segment_baseline: 0.9,
  // State effects (reference = PA)
  state_NY: 0.18,
  state_NJ: 0.18,
  state_FL: 0.14,
  state_CA: 0.1,
  state_TX: 0.05,
  state_CT: 0.1,
  state_MA: 0.05,
  state_MD: 0.0,
  state_OH: -0.1,
  state_MN: -0.16,
  state_WI: -0.16,
  state_MI: -0.1,
  state_AZ: -0.1,
  state_GA: -0.05,
  state_VA: -0.05,
  state_NC: -0.05,
  state_CO: 0.0,
  state_WA: -0.05,
  state_IL: 0.0,
  // Month effects (reference = months not listed -> 0)
  month_6: 0.1,
  month_7: 0.15,
  month_8: 0.25,
  month_9: 0.35,
  month_10: 0.2,
  month_11: 0.1,
} as const;

export const SEV_GLM = {
  intercept: 5.5, // ~$245 base severity
  age: 0.01, // per unit of (age - 40) / 10
  log_trip_cost: 0.6,
  product_flight: -0.2,
  post_departure: -0.3,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Product = "hotel" | "flight";
export type Segment = "winter_birds" | "holiday_travelers" | "baseline";

export interface FrequencyParams {
  age: number;
  tripCost: number;
  product: Product;
  segment: Segment;
  state: string; // two-letter abbreviation
  month: number; // 1-12
}

export interface SeverityParams {
  age: number;
  tripCost: number;
  product: Product;
  postDeparture: boolean;
}

export type PurePremiumParams = FrequencyParams & SeverityParams;

// ---------------------------------------------------------------------------
// Computation helpers
// ---------------------------------------------------------------------------

const STATE_KEYS: Record<string, keyof typeof FREQ_GLM> = {
  NY: "state_NY",
  NJ: "state_NJ",
  FL: "state_FL",
  CA: "state_CA",
  TX: "state_TX",
  CT: "state_CT",
  MA: "state_MA",
  MD: "state_MD",
  OH: "state_OH",
  MN: "state_MN",
  WI: "state_WI",
  MI: "state_MI",
  AZ: "state_AZ",
  GA: "state_GA",
  VA: "state_VA",
  NC: "state_NC",
  CO: "state_CO",
  WA: "state_WA",
  IL: "state_IL",
};

const SEGMENT_KEYS: Record<Segment, keyof typeof FREQ_GLM | null> = {
  winter_birds: null, // reference level
  holiday_travelers: "segment_holiday",
  baseline: "segment_baseline",
};

/**
 * Compute claim frequency via the log-link GLM.
 * Returns exp(linear predictor).
 */
export function computeFrequency(params: FrequencyParams): number {
  const { age, tripCost, product, segment, state, month } = params;

  let eta = FREQ_GLM.intercept;
  eta += FREQ_GLM.age * ((age - 40) / 10);
  eta += FREQ_GLM.log_trip_cost * Math.log(tripCost);
  if (product === "flight") eta += FREQ_GLM.product_flight;

  const segKey = SEGMENT_KEYS[segment];
  if (segKey) eta += FREQ_GLM[segKey];

  const stKey = STATE_KEYS[state.toUpperCase()];
  if (stKey) eta += FREQ_GLM[stKey];

  const monthKey = `month_${month}` as keyof typeof FREQ_GLM;
  if (monthKey in FREQ_GLM) eta += FREQ_GLM[monthKey];

  return Math.exp(eta);
}

/**
 * Compute claim severity via the log-link GLM.
 * Returns exp(linear predictor).
 */
export function computeSeverity(params: SeverityParams): number {
  const { age, tripCost, product, postDeparture } = params;

  let eta = SEV_GLM.intercept;
  eta += SEV_GLM.age * ((age - 40) / 10);
  eta += SEV_GLM.log_trip_cost * Math.log(tripCost);
  if (product === "flight") eta += SEV_GLM.product_flight;
  if (postDeparture) eta += SEV_GLM.post_departure;

  return Math.exp(eta);
}

/**
 * Pure premium = frequency x severity.
 */
export function computePurePremium(params: PurePremiumParams): number {
  return computeFrequency(params) * computeSeverity(params);
}

// ---------------------------------------------------------------------------
// Coefficient groups for display
// ---------------------------------------------------------------------------

export interface CoefficientEntry {
  name: string;
  key: string;
  value: number;
  description: string;
}

export interface CoefficientGroup {
  category: string;
  coefficients: CoefficientEntry[];
}

export const FREQ_COEFFICIENT_GROUPS: CoefficientGroup[] = [
  {
    category: "Base",
    coefficients: [
      {
        name: "Intercept",
        key: "intercept",
        value: FREQ_GLM.intercept,
        description: "Log-scale baseline frequency",
      },
    ],
  },
  {
    category: "Policyholder",
    coefficients: [
      {
        name: "Age",
        key: "age",
        value: FREQ_GLM.age,
        description: "Per unit of (age - 40) / 10",
      },
      {
        name: "Log trip cost",
        key: "log_trip_cost",
        value: FREQ_GLM.log_trip_cost,
        description: "Effect of ln(trip cost)",
      },
    ],
  },
  {
    category: "Product",
    coefficients: [
      {
        name: "Flight",
        key: "product_flight",
        value: FREQ_GLM.product_flight,
        description: "Flight vs hotel (reference)",
      },
    ],
  },
  {
    category: "Segment",
    coefficients: [
      {
        name: "Holiday travelers",
        key: "segment_holiday",
        value: FREQ_GLM.segment_holiday,
        description: "vs winter birds (reference)",
      },
      {
        name: "Baseline",
        key: "segment_baseline",
        value: FREQ_GLM.segment_baseline,
        description: "vs winter birds (reference)",
      },
    ],
  },
  {
    category: "State",
    coefficients: [
      { name: "New York", key: "state_NY", value: FREQ_GLM.state_NY, description: "vs PA (reference)" },
      { name: "New Jersey", key: "state_NJ", value: FREQ_GLM.state_NJ, description: "vs PA (reference)" },
      { name: "Florida", key: "state_FL", value: FREQ_GLM.state_FL, description: "vs PA (reference)" },
      { name: "California", key: "state_CA", value: FREQ_GLM.state_CA, description: "vs PA (reference)" },
      { name: "Connecticut", key: "state_CT", value: FREQ_GLM.state_CT, description: "vs PA (reference)" },
      { name: "Texas", key: "state_TX", value: FREQ_GLM.state_TX, description: "vs PA (reference)" },
      { name: "Massachusetts", key: "state_MA", value: FREQ_GLM.state_MA, description: "vs PA (reference)" },
      { name: "Maryland", key: "state_MD", value: FREQ_GLM.state_MD, description: "vs PA (reference)" },
      { name: "Illinois", key: "state_IL", value: FREQ_GLM.state_IL, description: "vs PA (reference)" },
      { name: "Colorado", key: "state_CO", value: FREQ_GLM.state_CO, description: "vs PA (reference)" },
      { name: "Washington", key: "state_WA", value: FREQ_GLM.state_WA, description: "vs PA (reference)" },
      { name: "Georgia", key: "state_GA", value: FREQ_GLM.state_GA, description: "vs PA (reference)" },
      { name: "Virginia", key: "state_VA", value: FREQ_GLM.state_VA, description: "vs PA (reference)" },
      { name: "North Carolina", key: "state_NC", value: FREQ_GLM.state_NC, description: "vs PA (reference)" },
      { name: "Ohio", key: "state_OH", value: FREQ_GLM.state_OH, description: "vs PA (reference)" },
      { name: "Michigan", key: "state_MI", value: FREQ_GLM.state_MI, description: "vs PA (reference)" },
      { name: "Arizona", key: "state_AZ", value: FREQ_GLM.state_AZ, description: "vs PA (reference)" },
      { name: "Minnesota", key: "state_MN", value: FREQ_GLM.state_MN, description: "vs PA (reference)" },
      { name: "Wisconsin", key: "state_WI", value: FREQ_GLM.state_WI, description: "vs PA (reference)" },
    ],
  },
  {
    category: "Seasonality",
    coefficients: [
      { name: "June", key: "month_6", value: FREQ_GLM.month_6, description: "vs other months (reference)" },
      { name: "July", key: "month_7", value: FREQ_GLM.month_7, description: "vs other months (reference)" },
      { name: "August", key: "month_8", value: FREQ_GLM.month_8, description: "vs other months (reference)" },
      { name: "September", key: "month_9", value: FREQ_GLM.month_9, description: "vs other months (reference)" },
      { name: "October", key: "month_10", value: FREQ_GLM.month_10, description: "vs other months (reference)" },
      { name: "November", key: "month_11", value: FREQ_GLM.month_11, description: "vs other months (reference)" },
    ],
  },
];

export const SEV_COEFFICIENT_GROUPS: CoefficientGroup[] = [
  {
    category: "Base",
    coefficients: [
      {
        name: "Intercept",
        key: "intercept",
        value: SEV_GLM.intercept,
        description: "Log-scale baseline severity (~$245)",
      },
    ],
  },
  {
    category: "Policyholder",
    coefficients: [
      {
        name: "Age",
        key: "age",
        value: SEV_GLM.age,
        description: "Per unit of (age - 40) / 10",
      },
      {
        name: "Log trip cost",
        key: "log_trip_cost",
        value: SEV_GLM.log_trip_cost,
        description: "Effect of ln(trip cost)",
      },
    ],
  },
  {
    category: "Product",
    coefficients: [
      {
        name: "Flight",
        key: "product_flight",
        value: SEV_GLM.product_flight,
        description: "Flight vs hotel (reference)",
      },
    ],
  },
  {
    category: "Claim type",
    coefficients: [
      {
        name: "Post-departure",
        key: "post_departure",
        value: SEV_GLM.post_departure,
        description: "Post-departure vs pre-departure (reference)",
      },
    ],
  },
];
