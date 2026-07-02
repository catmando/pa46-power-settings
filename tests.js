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
near('PA forced std above 18k ignores baro', PA46_CALC.pressureAltitude(19000, 29.42), 19000, 0.001);
eq('altimeter forced at 19k', PA46_CALC.altimeterIsForcedStandard(19000), true);
eq('altimeter not forced at 18k', PA46_CALC.altimeterIsForcedStandard(18000), false);

// === 2. RPM / MAP band selection ============================================
// 65% Economy: <15k -> 2300/28, 15-20k -> 2400/26.5, >=20k -> 2500/25
eq('65% @14,999 -> 2300', solve(14999, 29.92, 0, '65').rpm, 2300);
eq('65% @15,000 -> 2400', solve(15000, 29.92, 0, '65').rpm, 2400);
eq('65% @19,999 -> 2400', PA46_CALC.selectRpmOption('65', 19999).rpm, 2400);
eq('65% @20,000 -> 2500', PA46_CALC.selectRpmOption('65', 20000).rpm, 2500);
eq('65% @15k MAP 26.5', solve(15000, 29.92, 0, '65').manifoldPressureInHg, 26.5);
// 55% Long Range: same boundaries, 2200/2300/2400
eq('55% @14,999 -> 2200', PA46_CALC.selectRpmOption('55', 14999).rpm, 2200);
eq('55% @15,000 -> 2300', PA46_CALC.selectRpmOption('55', 15000).rpm, 2300);
eq('55% @20,000 -> 2400', PA46_CALC.selectRpmOption('55', 20000).rpm, 2400);
// 75% High Speed: single 20k split, 2400/2500
eq('75% @19,999 -> 2400', PA46_CALC.selectRpmOption('75', 19999).rpm, 2400);
eq('75% @20,000 -> 2500', PA46_CALC.selectRpmOption('75', 20000).rpm, 2500);
eq('75% @20k MAP 29.5', PA46_CALC.selectRpmOption('75', 20000).map, 29.5);
// Holding: single value at all altitudes
eq('Holding rpm 2200', PA46_CALC.selectRpmOption('HOLD', 25000).rpm, 2200);

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
near('TAS 65% @10k anchor = 165', PA46_CALC.tasFromChart('65', 10000), 165, 1e-9);
// Midpoint 11k is the mean of 10k(165) and 12k(168) = 166.5
near('TAS 65% @11k midpoint = 166.5', PA46_CALC.tasFromChart('65', 11000), 166.5, 1e-9);
// Quarter point 10.5k between 165 and 168 -> 165.75
near('TAS 65% @10.5k quarter = 165.75', PA46_CALC.tasFromChart('65', 10500), 165.75, 1e-9);
// Clamp below SL and above ceiling
near('TAS 55% clamp below SL = 133', PA46_CALC.tasFromChart('55', -1000), 133, 1e-9);
near('TAS 75% clamp above 25k = 200', PA46_CALC.tasFromChart('75', 30000), 200, 1e-9);
eq('Holding has no TAS', solve(10000, 29.92, -5, 'HOLD').tasKt, null);

// === 5. Warnings ============================================================
ok('Holding warns above 20k', solve(21000, 29.92, -27, 'HOLD').warnings.length >= 1);
ok('Holding no warn at 15k', solve(15000, 29.92, -15, 'HOLD').warnings.length === 0);

// === 6. Airframe bias (uniform %) ===========================================
// -10 kt at 18,000 ft vs 75% book (192) = -5.208%
near('biasKtToPct(-10,18k) = -5.208%', PA46_CALC.biasKtToPct(-10, 18000), -5.208333, 1e-4);
// Applied uniformly: 65% @18k book 176 -> 176*(1-0.05208) = 166.83
near('bias applied to 65% @18k', solve(18000, 29.92, -21, '65', { biasPct: PA46_CALC.biasKtToPct(-10, 18000) }).tasKt, 166.83, 0.05);
// +2% bias raises 75% @10k (180) to 183.6
near('+2% bias on 75% @10k', solve(10000, 29.92, -5, '75', { biasPct: 2 }).tasKt, 183.6, 1e-6);

// === 7. TAS TRUTH TABLE (verify vs POH graph; ±2 kt) ========================
// TODO: replace each expected value with a reading taken directly off the POH
// "Cruise Speed vs. Altitude" chart. These currently mirror the digitized table,
// so they pass today; they become a real check once you enter graph-truth values.
const TAS_TRUTH = [
  // [power, pressureAltFt, expectedKtFromGraph]
  ['55', 5000, 142], ['55', 15000, 157], ['55', 25000, 166],
  ['65', 5000, 157], ['65', 15000, 172], ['65', 25000, 182],
  ['75', 5000, 172], ['75', 15000, 188], ['75', 25000, 200],
];
const TAS_TOL_KT = 2;
for (const [p, alt, truth] of TAS_TRUTH) {
  near('TAS truth ' + p + '% @' + alt + 'ft', PA46_CALC.tasFromChart(p, alt), truth, TAS_TOL_KT);
}

// === 8. OAT tracking with altitude (2 C / 1000 ft) ==========================
near('OAT +1000 ft cools 2C', PA46_CALC.oatAfterAltitudeChange(-21, 18000, 19000), -23, 1e-9);
near('OAT -1000 ft warms 2C', PA46_CALC.oatAfterAltitudeChange(-21, 18000, 17000), -19, 1e-9);
near('OAT +500 ft cools 1C', PA46_CALC.oatAfterAltitudeChange(-21, 18000, 18500), -22, 1e-9);
near('OAT +6000 ft cools 12C', PA46_CALC.oatAfterAltitudeChange(0, 4000, 10000), -12, 1e-9);
near('OAT same altitude unchanged', PA46_CALC.oatAfterAltitudeChange(-5, 10000, 10000), -5, 1e-9);

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
