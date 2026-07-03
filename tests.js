/*
 * Zero-dependency test suite for the PA46 calculation engine.
 * Run: node tests.js
 *
 * The engine (calc.js) and data (data.js) are DOM-free, so we load them into a
 * shared scope and exercise PA46_CALC / PA46_DATA directly. No framework.
 */
const fs = require('fs');
const path = require('path');

// --- Load data.js + calc.js into one scope (same as the browser) -----------
function loadEngine() {
  const dir = __dirname;
  const code =
    fs.readFileSync(path.join(dir, 'data.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(dir, 'calc.js'), 'utf8') + '\n' +
    'return { PA46_DATA: PA46_DATA, PA46_CALC: PA46_CALC };';
  // eslint-disable-next-line no-new-func
  return new Function(code)();
}
const { PA46_DATA, PA46_CALC } = loadEngine();

// --- Tiny test harness ------------------------------------------------------
let passed = 0, failed = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) { passed++; }
  else { failed++; failures.push(name + (detail ? '  — ' + detail : '')); }
}
function near(name, actual, expected, tol) {
  const d = Math.abs(actual - expected);
  ok(name, d <= tol, 'got ' + actual + ', expected ' + expected + ' ±' + tol);
}
function eq(name, actual, expected) {
  ok(name, actual === expected, 'got ' + JSON.stringify(actual) + ', expected ' + JSON.stringify(expected));
}

// Type data for the default aircraft — passed to the type-specific calc fns.
const TD = PA46_DATA.dataForType('PA46-310P');

const AC0 = { biasPct: 0 };
function solve(indAlt, baro, oat, power, ac) {
  return PA46_CALC.solve(
    { indicatedAltFt: indAlt, altimeterInHg: baro, oatC: oat, powerKey: power },
    ac || AC0
  );
}

// === 1. Pressure altitude ===================================================
near('PA standard 10k @29.92', PA46_CALC.pressureAltitude(10000, 29.92), 10000, 0.001);
near('PA low baro 29.42 -> +500', PA46_CALC.pressureAltitude(10000, 29.42), 10500, 0.001);
near('PA high baro 30.42 -> -500', PA46_CALC.pressureAltitude(10000, 30.42), 9500, 0.001);
// Above 18,000 ft the altimeter is forced to 29.92, so PA == indicated.
near('PA forced std at/above 18k ignores baro', PA46_CALC.pressureAltitude(19000, 29.42), 19000, 0.001);
eq('flight level at 19k', PA46_CALC.altimeterIsForcedStandard(19000), true);
eq('flight level at exactly 18k', PA46_CALC.altimeterIsForcedStandard(18000), true);
eq('not flight level at 17,999', PA46_CALC.altimeterIsForcedStandard(17999), false);

// === 2. RPM / MAP band selection ============================================
// 65% Economy: <15k -> 2300/28, 15-20k -> 2400/26.5, >=20k -> 2500/25
eq('65% @14,999 -> 2300', solve(14999, 29.92, 0, '65').rpm, 2300);
eq('65% @15,000 -> 2400', solve(15000, 29.92, 0, '65').rpm, 2400);
eq('65% @19,999 -> 2400', PA46_CALC.selectRpmOption(TD, '65', 19999).rpm, 2400);
eq('65% @20,000 -> 2500', PA46_CALC.selectRpmOption(TD, '65', 20000).rpm, 2500);
eq('65% @15k MAP 26.5', solve(15000, 29.92, 0, '65').manifoldPressureInHg, 26.5);
// 55% Long Range: same boundaries, 2200/2300/2400
eq('55% @14,999 -> 2200', PA46_CALC.selectRpmOption(TD, '55', 14999).rpm, 2200);
eq('55% @15,000 -> 2300', PA46_CALC.selectRpmOption(TD, '55', 15000).rpm, 2300);
eq('55% @20,000 -> 2400', PA46_CALC.selectRpmOption(TD, '55', 20000).rpm, 2400);
// 75% High Speed: single 20k split, 2400/2500
eq('75% @19,999 -> 2400', PA46_CALC.selectRpmOption(TD, '75', 19999).rpm, 2400);
eq('75% @20,000 -> 2500', PA46_CALC.selectRpmOption(TD, '75', 20000).rpm, 2500);
eq('75% @20k MAP 29.5', PA46_CALC.selectRpmOption(TD, '75', 20000).map, 29.5);
// Holding: single value at all altitudes
eq('Holding rpm 2200', PA46_CALC.selectRpmOption(TD, 'HOLD', 25000).rpm, 2200);

// === 3. Fuel-flow temperature correction ====================================
// ISA at 10k = 15 - 20 = -5 C. OAT == ISA -> no correction.
near('FF 65% @10k at ISA = base 14', solve(10000, 29.92, -5, '65').fuelFlow.totalGph, 14, 1e-9);
// 20 C BELOW ISA (-25) -> +1 GPH
near('FF 65% @10k 20C below ISA = 15', solve(10000, 29.92, -25, '65').fuelFlow.totalGph, 15, 1e-9);
// 20 C ABOVE ISA (+15) -> -1 GPH
near('FF 65% @10k 20C above ISA = 13', solve(10000, 29.92, 15, '65').fuelFlow.totalGph, 13, 1e-9);
// 75% base is 16
near('FF 75% @10k at ISA = 16', solve(10000, 29.92, -5, '75').fuelFlow.totalGph, 16, 1e-9);

// === 4. TAS interpolation (structure, not truth) ============================
// Anchor points return exactly the table values.
near('TAS 65% @10k anchor = 172', PA46_CALC.tasFromChart(TD, '65', 10000), 172, 1e-9);
// Midpoint 11k is the mean of 10k(165) and 12k(168) = 166.5
near('TAS 65% @11k midpoint = 174.5', PA46_CALC.tasFromChart(TD, '65', 11000), 174.5, 1e-9);
// Quarter point 10.5k between 165 and 168 -> 165.75
near('TAS 65% @10.5k quarter = 173.25', PA46_CALC.tasFromChart(TD, '65', 10500), 173.25, 1e-9);
// Clamp below SL and above the top of the table (24,000 ft)
near('TAS 55% clamp below SL = 134', PA46_CALC.tasFromChart(TD, '55', -1000), 134, 1e-9);
near('TAS 75% clamp above table = 213', PA46_CALC.tasFromChart(TD, '75', 30000), 213, 1e-9);
eq('Holding has no TAS', solve(10000, 29.92, -5, 'HOLD').tasKt, null);

// === 5. Warnings ============================================================
ok('Holding warns above 20k', solve(21000, 29.92, -27, 'HOLD').warnings.length >= 1);
ok('Holding no warn at 15k', solve(15000, 29.92, -15, 'HOLD').warnings.length === 0);

// === 6. Airframe bias (uniform %) ===========================================
// -10 kt at 18,000 ft vs 75% book (192) = -5.208%
near('biasKtToPct(-10,18k) = -4.975%', PA46_CALC.biasKtToPct(TD, -10, 18000), -4.975124, 1e-4);
// Applied uniformly: 65% @18k book 190 -> 190*(1-10/201) = 180.55
near('bias applied to 65% @18k', solve(18000, 29.92, -21, '65', { biasPct: PA46_CALC.biasKtToPct(TD, -10, 18000) }).tasKt, 180.55, 0.05);
// +2% bias raises 75% @10k (184) to 187.68
near('+2% bias on 75% @10k', solve(10000, 29.92, -5, '75', { biasPct: 2 }).tasKt, 187.68, 1e-6);

// === 7. TAS TRUTH TABLE (guards the digitized chart values; ±2 kt) ==========
// Spot-check points from the digitized "Cruise Speed vs. Altitude" table, so an
// accidental edit to TAS_TABLE gets caught. Update these if the table changes.
const TAS_TRUTH = [
  // [power, pressureAltFt, expectedKtFromGraph]
  ['55', 5000, 146], ['55', 15000, 172], ['55', 24000, 193],
  ['65', 5000, 160], ['65', 15000, 184], ['65', 24000, 202],
  ['75', 5000, 173], ['75', 15000, 195], ['75', 24000, 213],
];
const TAS_TOL_KT = 2;
for (const [p, alt, truth] of TAS_TRUTH) {
  near('TAS truth ' + p + '% @' + alt + 'ft', PA46_CALC.tasFromChart(TD, p, alt), truth, TAS_TOL_KT);
}

// === 8. OAT tracking with altitude (2 C / 1000 ft) ==========================
near('OAT +1000 ft cools 2C', PA46_CALC.oatAfterAltitudeChange(-21, 18000, 19000), -23, 1e-9);
near('OAT -1000 ft warms 2C', PA46_CALC.oatAfterAltitudeChange(-21, 18000, 17000), -19, 1e-9);
near('OAT +500 ft cools 1C', PA46_CALC.oatAfterAltitudeChange(-21, 18000, 18500), -22, 1e-9);
near('OAT +6000 ft cools 12C', PA46_CALC.oatAfterAltitudeChange(0, 4000, 10000), -12, 1e-9);
near('OAT same altitude unchanged', PA46_CALC.oatAfterAltitudeChange(-5, 10000, 10000), -5, 1e-9);

// === 9. TAS -> IAS (density ratio) ==========================================
near('IAS == TAS at SL/ISA', PA46_CALC.tasToIas(150, 0, 15), 150, 0.5);
near('IAS ~133 for TAS 176 @18k ISA', PA46_CALC.tasToIas(176, 18000, -21), 133, 2);
ok('IAS < TAS at altitude', PA46_CALC.tasToIas(176, 18000, -21) < 176);
ok('sigma decreases with altitude',
  PA46_CALC.densityRatio(18000, -21) < PA46_CALC.densityRatio(0, 15));

// === 10. Multi-type support (proves the calc is fully type-driven) ==========
// Inject a throwaway second type with distinct numbers and confirm solve() uses
// THEM, not the PA46-310P defaults. (Does not ship in the app.)
PA46_DATA.AIRCRAFT_DATA['TEST-X'] = {
  label: 'Test X', engine: 'test', referenceWeightLb: 4000, ceilingFt: 20000,
  powerOrder: ['75'],
  powerSettings: { '75': { key: '75', label: 'HS', short: 'HS', percent: 75,
    baseFuelGph: 20, rpmOptions: [ { rpm: 2700, map: 35, autoMaxFt: Infinity } ] } },
  tas: { altitudesFt: [0, 10000], '75': [200, 250] },
};
const TX = { type: 'TEST-X', biasPct: 0 };
const rx = PA46_CALC.solve({ indicatedAltFt: 0, altimeterInHg: 29.92, oatC: 15, powerKey: '75' }, TX);
eq('type-driven RPM', rx.rpm, 2700);
eq('type-driven MAP', rx.manifoldPressureInHg, 35);
near('type-driven fuel flow @SL/ISA', rx.fuelFlow.totalGph, 20, 1e-9);
near('type-driven TAS @SL', rx.tasKt, 200, 1e-9);
near('type-driven TAS @5k interp', PA46_CALC.tasFromChart(PA46_DATA.dataForType('TEST-X'), '75', 5000), 225, 1e-9);
ok('type-driven ceiling warning @22k (type ceiling 20k)',
  PA46_CALC.solve({ indicatedAltFt: 22000, altimeterInHg: 29.92, oatC: -30, powerKey: '75' }, TX)
    .warnings.some(function (w) { return /20,000/.test(w); }));
eq('unknown type falls back to default',
  PA46_DATA.dataForType('nope').label, PA46_DATA.dataForType('PA46-310P').label);

// --- Report -----------------------------------------------------------------
console.log('\nPA46 engine tests');
console.log('  passed: ' + passed);
console.log('  failed: ' + failed);
if (failed) {
  console.log('\nFailures:');
  failures.forEach(function (f) { console.log('  ✗ ' + f); });
  process.exit(1);
} else {
  console.log('\nAll tests passed. ✓');
}
