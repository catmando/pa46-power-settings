/*
 * PA46-310P (Piper Malibu, Continental TSIO-520-BE) performance data.
 *
 * Sources:
 *   - POH power-setting table (RPM / Manifold Pressure / Fuel Flow, 50 deg LOP)
 *   - POH "Cruise Speed vs. Altitude" chart (TAS vs pressure altitude, std temp)
 *
 * IMPORTANT: The TAS_TABLE values are a best-estimate DIGITIZATION of the scanned
 * chart. They are the single thing most worth verifying against the actual POH.
 * They live here, in one place, so corrections are a one-line edit. Everything
 * else (the power table) is transcribed directly from the printed text.
 */

// --- Aircraft types ----------------------------------------------------------
// Only the PA46-310P exists today. Structured as a list so more types can be
// added later; each record's `id` is stored on the aircraft. For now every type
// resolves to the single data set below (power table + TAS table).
const AIRCRAFT_TYPES = [
  { id: 'PA46-310P', label: 'PA46-310P (Malibu)' },
];
const DEFAULT_AIRCRAFT_TYPE = AIRCRAFT_TYPES[0].id;

// --- ISA standard atmosphere -------------------------------------------------
const ISA_SEA_LEVEL_TEMP_C = 15;      // deg C at sea level
const ISA_LAPSE_C_PER_1000FT = 2;     // drops 2 deg C per 1000 ft

// Standard (ISA) OAT for a given pressure altitude, in deg C.
function isaTempC(pressureAltFt) {
  return ISA_SEA_LEVEL_TEMP_C - ISA_LAPSE_C_PER_1000FT * (pressureAltFt / 1000);
}

// --- Power settings (transcribed directly from POH text) ---------------------
// Each RPM has its own matched Manifold Pressure. baseFuelGph is at standard temp.
//
// autoMaxFt = the pressure altitude (exclusive upper bound) below which this RPM
// is the auto-selected default. Options are listed low->high RPM; the app picks
// the first option whose autoMaxFt is greater than the pressure altitude, else
// the last (highest) option. This encodes the POH rule "higher RPM at altitude":
//   75%      -> low RPM below 20k, high RPM at/above 20k
//   65%/55%  -> lowest below 15k, middle 15k-20k, highest at/above 20k
// The user can always override the auto choice from the RPM dropdown.
const POWER_SETTINGS = {
  '75': {
    key: '75',
    label: 'High Speed Cruise',
    percent: 75,
    baseFuelGph: 16,
    rpmOptions: [
      { rpm: 2400, map: 31.0, autoMaxFt: 20000 },
      { rpm: 2500, map: 29.5, autoMaxFt: Infinity },
    ],
  },
  '65': {
    key: '65',
    label: 'Economy Cruise',
    percent: 65,
    baseFuelGph: 14,
    rpmOptions: [
      { rpm: 2300, map: 28.0, autoMaxFt: 15000 },
      { rpm: 2400, map: 26.5, autoMaxFt: 20000 },
      { rpm: 2500, map: 25.0, autoMaxFt: Infinity },
    ],
  },
  '55': {
    key: '55',
    label: 'Long Range Cruise',
    percent: 55,
    baseFuelGph: 12,
    rpmOptions: [
      { rpm: 2200, map: 25.0, autoMaxFt: 15000 },
      { rpm: 2300, map: 24.0, autoMaxFt: 20000 },
      { rpm: 2400, map: 23.0, autoMaxFt: Infinity },
    ],
  },
  'HOLD': {
    key: 'HOLD',
    label: 'Holding',
    percent: null,
    baseFuelGph: 10,
    rpmOptions: [ { rpm: 2200, map: 21.0, autoMaxFt: Infinity } ],
    // "Holding power is not attainable or intended for use at high altitude."
    noHighAltitude: true,
    // No cruise-speed curve on the chart for holding.
    noTas: true,
  },
};

// Order the power selector should present buttons in.
const POWER_ORDER = ['75', '65', '55', 'HOLD'];

// --- TAS table (knots) -------------------------------------------------------
// Best-estimate digitization of "Cruise Speed vs. Altitude", at STANDARD temp
// and the chart's reference weight of 3740 lb. Rows every 2000 ft, SL -> 25000.
// VERIFY THESE against the POH chart; edit in place as needed.
const TAS_TABLE = {
  altitudesFt: [0, 2000, 4000, 6000, 8000, 10000, 12000, 14000, 16000, 18000, 20000, 22000, 24000, 25000],
  '55': [133, 137, 140, 144, 147, 150, 153, 156, 158, 161, 163, 164, 165, 166],
  '65': [148, 152, 155, 159, 162, 165, 168, 171, 173, 176, 178, 180, 181, 182],
  '75': [163, 167, 170, 174, 177, 180, 183, 186, 189, 192, 195, 197, 199, 200],
};

// --- Fixed reference values --------------------------------------------------
const REFERENCE_WEIGHT_LB = 3740;             // TAS chart reference weight
const WEIGHT_KT_PER_100LB = 0.8;              // faster when lighter, slower when heavier
const HIGH_ALT_RPM_THRESHOLD_FT = 20000;      // use higher RPM above this altitude
const FUELFLOW_GPH_PER_20C = 1;               // +1 GPH per 20C below ISA, -1 per 20C above
const CEILING_FT = 25000;                     // top of the published data

// Expose as a namespace so app.js and the service worker share one source.
const PA46_DATA = {
  AIRCRAFT_TYPES,
  DEFAULT_AIRCRAFT_TYPE,
  isaTempC,
  POWER_SETTINGS,
  POWER_ORDER,
  TAS_TABLE,
  REFERENCE_WEIGHT_LB,
  WEIGHT_KT_PER_100LB,
  HIGH_ALT_RPM_THRESHOLD_FT,
  FUELFLOW_GPH_PER_20C,
  CEILING_FT,
  ISA_SEA_LEVEL_TEMP_C,
  ISA_LAPSE_C_PER_1000FT,
};
