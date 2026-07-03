/*
 * PA46-310P calculation engine. Pure functions, no DOM. Depends on PA46_DATA
 * (data.js). Kept separate from app.js so the numbers can be unit-tested or
 * reused without the UI.
 */

const STANDARD_ALTIMETER_INHG = 29.92;
const FLIGHT_LEVEL_TRANSITION_FT = 18000; // above this, altimeter is set to 29.92

// Pressure altitude from assigned altitude + altimeter setting.
//   PA = assigned + (29.92 - altimeter) * 1000
// At/above 18,000 ft (the flight levels) the altimeter is standard (29.92), so
// PA == assigned and there is nothing extra to show.
function pressureAltitude(assignedAltFt, altimeterInHg) {
  const baro = assignedAltFt >= FLIGHT_LEVEL_TRANSITION_FT ? STANDARD_ALTIMETER_INHG : altimeterInHg;
  return assignedAltFt + (STANDARD_ALTIMETER_INHG - baro) * 1000;
}

// Are we in the flight levels (>= 18,000 ft), where the altimeter is 29.92 and
// pressure altitude equals the assigned altitude?
function altimeterIsForcedStandard(assignedAltFt) {
  return assignedAltFt >= FLIGHT_LEVEL_TRANSITION_FT;
}

// Auto-select the RPM/MAP option for a power setting at a pressure altitude,
// using each option's autoMaxFt band. Returns { rpm, map }.
function selectRpmOption(powerKey, pressureAltFt) {
  const setting = PA46_DATA.POWER_SETTINGS[powerKey];
  const opts = setting.rpmOptions;
  for (const opt of opts) {
    if (pressureAltFt < opt.autoMaxFt) return opt;
  }
  return opts[opts.length - 1];
}

// Fuel flow (GPH), corrected for temperature deviation from ISA.
//   +1 GPH per 20 C below standard, -1 GPH per 20 C above standard.
function fuelFlow(powerKey, pressureAltFt, oatC) {
  const base = PA46_DATA.POWER_SETTINGS[powerKey].baseFuelGph;
  const isa = PA46_DATA.isaTempC(pressureAltFt);
  const correction = ((isa - oatC) / 20) * PA46_DATA.FUELFLOW_GPH_PER_20C;
  return {
    base,
    isaTempC: isa,
    correctionGph: correction,
    totalGph: base + correction,
  };
}

// Linear interpolation of the TAS table for a power setting at a pressure
// altitude. Clamps to the table ends (SL and the 25,000 ft ceiling).
function tasFromChart(powerKey, pressureAltFt) {
  const table = PA46_DATA.TAS_TABLE;
  const series = table[powerKey];
  if (!series) return null; // e.g. Holding has no curve
  const alts = table.altitudesFt;

  if (pressureAltFt <= alts[0]) return series[0];
  if (pressureAltFt >= alts[alts.length - 1]) return series[series.length - 1];

  for (let i = 0; i < alts.length - 1; i++) {
    const a0 = alts[i], a1 = alts[i + 1];
    if (pressureAltFt >= a0 && pressureAltFt <= a1) {
      const t = (pressureAltFt - a0) / (a1 - a0);
      return series[i] + t * (series[i + 1] - series[i]);
    }
  }
  return series[series.length - 1];
}

// Convert a "X kt at altitude Y" airframe measurement into a uniform percentage
// bias, using the 75% High-Speed Cruise curve (where owners typically measure).
function biasKtToPct(kt, refAltFt) {
  const ref = tasFromChart('75', refAltFt);
  if (!ref) return 0;
  return (kt / ref) * 100;
}

// Air density ratio (sigma) vs. sea-level standard, from pressure altitude and
// actual OAT.  delta = pressure ratio (standard), theta = temperature ratio.
function densityRatio(pressureAltFt, oatC) {
  const delta = Math.pow(1 - 6.87535e-6 * pressureAltFt, 5.2558797);
  const theta = (oatC + 273.15) / 288.15;
  return theta > 0 ? delta / theta : 0;
}

// Estimated indicated/calibrated airspeed from TAS: IAS ≈ TAS × sqrt(sigma).
// Lets a pilot sanity-check their airspeed indicator against the book.
function tasToIas(tasKt, pressureAltFt, oatC) {
  const sigma = densityRatio(pressureAltFt, oatC);
  return sigma > 0 ? tasKt * Math.sqrt(sigma) : tasKt;
}

// Track OAT as altitude changes: shift by the ISA lapse rate (2 C / 1000 ft)
// from the current value, so a re-assigned altitude keeps a realistic OAT while
// preserving the pilot's deviation from standard. Returns an unrounded value;
// the UI rounds and clamps. Cooling with climb -> OAT drops as altitude rises.
function oatAfterAltitudeChange(curOatC, oldAltFt, newAltFt) {
  const deltaThousands = (newAltFt - oldAltFt) / 1000;
  return curOatC - PA46_DATA.ISA_LAPSE_C_PER_1000FT * deltaThousands;
}

// Full solution for a set of inputs.
//   inputs: { indicatedAltFt, altimeterInHg, oatC, powerKey }
//   aircraft: { biasPct } (per-aircraft airspeed adjustment, uniform %)
function solve(inputs, aircraft) {
  const { indicatedAltFt, altimeterInHg, oatC, powerKey } = inputs;
  const setting = PA46_DATA.POWER_SETTINGS[powerKey];

  const paFt = pressureAltitude(indicatedAltFt, altimeterInHg);
  const forcedStandard = altimeterIsForcedStandard(indicatedAltFt);
  const rpmOpt = selectRpmOption(powerKey, paFt);
  const ff = fuelFlow(powerKey, paFt, oatC);

  const biasPct = aircraft && Number.isFinite(aircraft.biasPct) ? aircraft.biasPct : 0;
  let chartTas = setting.noTas ? null : tasFromChart(powerKey, paFt);
  const tas = chartTas == null ? null : chartTas * (1 + biasPct / 100);

  const warnings = [];
  if (setting.noHighAltitude && paFt > PA46_DATA.HIGH_ALT_RPM_THRESHOLD_FT) {
    warnings.push('Holding power is not intended for use at high altitude.');
  }
  if (paFt > PA46_DATA.CEILING_FT) {
    warnings.push('Pressure altitude is above the published ceiling (25,000 ft).');
  }

  return {
    pressureAltFt: paFt,
    altimeterForcedStandard: forcedStandard,
    effectiveAltimeterInHg: forcedStandard ? STANDARD_ALTIMETER_INHG : altimeterInHg,
    rpm: rpmOpt.rpm,
    manifoldPressureInHg: rpmOpt.map,
    fuelFlow: ff,
    isaTempC: ff.isaTempC,
    chartTasKt: chartTas,
    airframeBiasPct: biasPct,
    tasKt: tas,
    warnings,
    setting,
  };
}

const PA46_CALC = {
  STANDARD_ALTIMETER_INHG,
  FLIGHT_LEVEL_TRANSITION_FT,
  pressureAltitude,
  altimeterIsForcedStandard,
  selectRpmOption,
  fuelFlow,
  tasFromChart,
  biasKtToPct,
  oatAfterAltitudeChange,
  densityRatio,
  tasToIas,
  solve,
};
