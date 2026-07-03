/*
 * PA46 performance data, keyed by aircraft type.
 *
 * To add another PA46 variant (e.g. PA46-350P Mirage, PA46-500TP Meridian):
 *   1. Copy the 'PA46-310P' block in AIRCRAFT_DATA below.
 *   2. Give it a new id + label, and fill in that variant's numbers:
 *        - powerSettings (RPM / manifold pressure / base fuel flow per power)
 *        - tas           (Cruise Speed vs. Altitude table)
 *        - referenceWeightLb, ceilingFt
 *   3. That's it — the type dropdown, power buttons, and every calculation
 *      become type-driven automatically. Nothing else needs to change.
 * A commented TEMPLATE is at the bottom of AIRCRAFT_DATA.
 *
 * Sources for PA46-310P: POH power-setting table (text) + "Cruise Speed vs.
 * Altitude" chart (digitized). The tas numbers are the digitization; the power
 * table is transcribed from the printed text.
 */

// --- Shared physics (same for every variant) ---------------------------------
const ISA_SEA_LEVEL_TEMP_C = 15;      // deg C at sea level
const ISA_LAPSE_C_PER_1000FT = 2;     // drops 2 deg C per 1000 ft
function isaTempC(pressureAltFt) {
  return ISA_SEA_LEVEL_TEMP_C - ISA_LAPSE_C_PER_1000FT * (pressureAltFt / 1000);
}
const WEIGHT_KT_PER_100LB = 0.8;      // faster when lighter (not currently applied)
const HIGH_ALT_RPM_THRESHOLD_FT = 20000; // Holding "high altitude" warning threshold
const FUELFLOW_GPH_PER_20C = 1;       // +1 GPH per 20C below ISA, -1 per 20C above

// --- Per-type performance data -----------------------------------------------
// autoMaxFt = pressure altitude (exclusive upper bound) below which this RPM is
// the auto-selected default. Options listed low->high RPM; the app picks the
// first whose autoMaxFt exceeds the pressure altitude, else the last. Encodes
// the POH "higher RPM at altitude" rule.
const AIRCRAFT_DATA = {
  'PA46-310P': {
    label: 'PA46-310P (Malibu)',
    engine: 'Continental TSIO-520-BE',
    referenceWeightLb: 3740,          // TAS table reference weight
    ceilingFt: 25000,                 // top of the published data
    powerOrder: ['75', '65', '55', 'HOLD'],
    powerSettings: {
      '75': {
        key: '75', label: 'High Speed Cruise', short: 'High Speed',
        percent: 75, baseFuelGph: 16,
        rpmOptions: [
          { rpm: 2400, map: 31.0, autoMaxFt: 20000 },
          { rpm: 2500, map: 29.5, autoMaxFt: Infinity },
        ],
      },
      '65': {
        key: '65', label: 'Economy Cruise', short: 'Economy',
        percent: 65, baseFuelGph: 14,
        rpmOptions: [
          { rpm: 2300, map: 28.0, autoMaxFt: 15000 },
          { rpm: 2400, map: 26.5, autoMaxFt: 20000 },
          { rpm: 2500, map: 25.0, autoMaxFt: Infinity },
        ],
      },
      '55': {
        key: '55', label: 'Long Range Cruise', short: 'Long Range',
        percent: 55, baseFuelGph: 12,
        rpmOptions: [
          { rpm: 2200, map: 25.0, autoMaxFt: 15000 },
          { rpm: 2300, map: 24.0, autoMaxFt: 20000 },
          { rpm: 2400, map: 23.0, autoMaxFt: Infinity },
        ],
      },
      'HOLD': {
        key: 'HOLD', label: 'Holding', short: 'Holding',
        percent: null, baseFuelGph: 10,
        rpmOptions: [ { rpm: 2200, map: 21.0, autoMaxFt: Infinity } ],
        noHighAltitude: true,  // "not attainable or intended for use at high altitude"
        noTas: true,           // no cruise-speed curve for holding
      },
    },
    // "Cruise Speed vs. Altitude" — knots, standard temp, reference weight.
    // Rows every 2000 ft SL->24,000 (concave curves). Clamps at the ends.
    tas: {
      altitudesFt: [0, 2000, 4000, 6000, 8000, 10000, 12000, 14000, 16000, 18000, 20000, 22000, 24000],
      '55': [134, 139, 144, 149, 154, 159, 164, 169, 174, 179, 184, 188, 193],
      '65': [148, 152, 157, 162, 167, 172, 177, 181, 186, 190, 194, 198, 202],
      '75': [161, 166, 171, 175, 179, 184, 188, 193, 197, 201, 206, 209, 213],
    },
  },

  // --- TEMPLATE for a new variant (uncomment, rename, fill in real POH data) --
  // 'PA46-350P': {
  //   label: 'PA46-350P (Mirage)',
  //   engine: 'Lycoming TIO-540-AE2A',
  //   referenceWeightLb: 0,
  //   ceilingFt: 25000,
  //   powerOrder: ['75', '65', '55', 'HOLD'],
  //   powerSettings: { '75': { key:'75', label:'High Speed Cruise', short:'High Speed',
  //     percent:75, baseFuelGph:0, rpmOptions:[{ rpm:0, map:0, autoMaxFt: Infinity }] },
  //     /* 65, 55, HOLD ... */ },
  //   tas: { altitudesFt: [0, /* ... */], '55': [/* ... */], '65': [/* ... */], '75': [/* ... */] },
  // },
};

const DEFAULT_AIRCRAFT_TYPE = 'PA46-310P';
const AIRCRAFT_TYPES = Object.keys(AIRCRAFT_DATA).map(function (id) {
  return { id: id, label: AIRCRAFT_DATA[id].label };
});
// Resolve a type id (or unknown) to its data, falling back to the default type.
function dataForType(typeId) {
  return AIRCRAFT_DATA[typeId] || AIRCRAFT_DATA[DEFAULT_AIRCRAFT_TYPE];
}

// Namespace shared by app.js, calc.js, and the service worker.
const PA46_DATA = {
  AIRCRAFT_DATA,
  AIRCRAFT_TYPES,
  DEFAULT_AIRCRAFT_TYPE,
  dataForType,
  isaTempC,
  WEIGHT_KT_PER_100LB,
  HIGH_ALT_RPM_THRESHOLD_FT,
  FUELFLOW_GPH_PER_20C,
  ISA_SEA_LEVEL_TEMP_C,
  ISA_LAPSE_C_PER_1000FT,
};
