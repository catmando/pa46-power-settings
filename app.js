/*
 * PA46 Power Settings — UI, persistence, and aircraft management.
 * Depends on PA46_DATA (data.js) and PA46_CALC (calc.js).
 */
(function () {
  'use strict';

  // --- Persistence ---------------------------------------------------------
  const LS = {
    aircraft: 'pa46.aircraft',
    activeId: 'pa46.activeId',
    inputs: 'pa46.inputs',
  };

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }
  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }

  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'ac-' + Date.now() + '-' + Math.floor(Math.random() * 1e6);
  }

  // --- App state -----------------------------------------------------------
  let aircraft = loadJSON(LS.aircraft, null);
  if (!Array.isArray(aircraft) || aircraft.length === 0) {
    aircraft = [{ id: newId(), type: PA46_DATA.DEFAULT_AIRCRAFT_TYPE, name: 'My PA46-310P', biasPct: 0, isDefault: true }];
    saveJSON(LS.aircraft, aircraft);
  } else {
    // Migrate older records: ensure type + biasPct; drop legacy airframeBiasKt.
    let changed = false;
    aircraft.forEach(function (a) {
      if (a.type == null) { a.type = PA46_DATA.DEFAULT_AIRCRAFT_TYPE; changed = true; }
      if (a.biasPct == null) { a.biasPct = 0; changed = true; }
      if ('airframeBiasKt' in a) { delete a.airframeBiasKt; changed = true; }
    });
    if (changed) saveJSON(LS.aircraft, aircraft);
  }
  let activeId = loadJSON(LS.activeId, null);
  if (!aircraft.some(a => a.id === activeId)) {
    const def = aircraft.find(a => a.isDefault) || aircraft[0];
    activeId = def.id;
  }

  // First-startup defaults: 18,000 ft, ISA temp there (-21 C), 65% power.
  const defaultInputs = { baro: 29.92, indAlt: 18000, oat: -21, powerKey: '65' };
  let inputs = Object.assign({}, defaultInputs, loadJSON(LS.inputs, {}));

  // Altitude stepper increment: 500 ft below 18,000, 1,000 ft at/above.
  const ALT_STEP_BREAK = 18000;
  function altStepUp(v) { return (v >= ALT_STEP_BREAK ? 1000 : 500); }
  function altStepDown(v) { return (v > ALT_STEP_BREAK ? 1000 : 500); }

  // Baseline altitude used to track OAT as altitude changes (see below).
  let lastIndAlt = Number.isFinite(inputs.indAlt) ? inputs.indAlt : ALT_STEP_BREAK;

  // Latest solved result + the timer for the "tap airspeed -> indicated" peek.
  let lastSolve = null;
  let iasTimer = null;

  // --- Elements ------------------------------------------------------------
  const el = {
    aircraftSelect: document.getElementById('aircraftSelect'),
    manageBtn: document.getElementById('manageBtn'),
    baro: document.getElementById('baro'),
    baroUp: document.getElementById('baroUp'),
    baroDown: document.getElementById('baroDown'),
    indAlt: document.getElementById('indAlt'),
    altUp: document.getElementById('altUp'),
    altDown: document.getElementById('altDown'),
    oat: document.getElementById('oat'),
    oatUp: document.getElementById('oatUp'),
    oatDown: document.getElementById('oatDown'),
    infoLine: document.getElementById('infoLine'),
    powerButtons: document.getElementById('powerButtons'),
    rRPM: document.getElementById('rRPM'),
    rMAP: document.getElementById('rMAP'),
    rFF: document.getElementById('rFF'),
    rTAS: document.getElementById('rTAS'),
    speedCell: document.getElementById('speedCell'),
    tasLabel: document.getElementById('tasLabel'),
    warnings: document.getElementById('warnings'),
    // dialog
    dialog: document.getElementById('manageDialog'),
    aircraftList: document.getElementById('aircraftList'),
    addAircraftBtn: document.getElementById('addAircraftBtn'),
    editor: document.getElementById('editor'),
    editId: document.getElementById('editId'),
    editType: document.getElementById('editType'),
    editName: document.getElementById('editName'),
    biasMode: document.getElementById('biasMode'),
    biasPctRow: document.getElementById('biasPctRow'),
    biasKtRow: document.getElementById('biasKtRow'),
    editBiasPct: document.getElementById('editBiasPct'),
    editBiasKt: document.getElementById('editBiasKt'),
    editBiasAlt: document.getElementById('editBiasAlt'),
    biasHelp: document.getElementById('biasHelp'),
    editDefault: document.getElementById('editDefault'),
    editorTitle: document.getElementById('editorTitle'),
    saveAircraftBtn: document.getElementById('saveAircraftBtn'),
    cancelEditBtn: document.getElementById('cancelEditBtn'),
    closeDialogBtn: document.getElementById('closeDialogBtn'),
  };

  function activeAircraft() {
    return aircraft.find(a => a.id === activeId) || aircraft[0];
  }

  // --- Render: aircraft picker --------------------------------------------
  function renderAircraftPicker() {
    el.aircraftSelect.innerHTML = '';
    for (const a of aircraft) {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = a.name + (a.isDefault ? '  ★' : '');
      if (a.id === activeId) opt.selected = true;
      el.aircraftSelect.appendChild(opt);
    }
  }

  // --- Render: power buttons ----------------------------------------------
  // RPM range without the "RPM" word, so the sub-line stays one line on a phone.
  function rpmRangeLabel(setting) {
    const rpms = setting.rpmOptions.map(o => o.rpm);
    const lo = Math.min.apply(null, rpms);
    const hi = Math.max.apply(null, rpms);
    return lo === hi ? ('' + lo) : (lo + '–' + hi);
  }

  function renderPowerButtons() {
    el.powerButtons.innerHTML = '';
    for (const key of PA46_DATA.POWER_ORDER) {
      const s = PA46_DATA.POWER_SETTINGS[key];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'power-btn' + (key === inputs.powerKey ? ' active' : '');
      btn.dataset.key = key;
      const title = s.percent ? (s.short + ' ' + s.percent + '%') : s.short;
      btn.innerHTML = '<span class="pb-title">' + title + '</span>' +
                      '<span class="pb-sub">' + rpmRangeLabel(s) + ' · ' + s.baseFuelGph + ' GPH</span>';
      btn.addEventListener('click', function () {
        inputs.powerKey = key;
        persistInputs();
        renderPowerButtons();
        recompute();
      });
      el.powerButtons.appendChild(btn);
    }
  }

  // --- Inputs --------------------------------------------------------------
  function num(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }

  function persistInputs() { saveJSON(LS.inputs, inputs); }

  function syncInputsToFields() {
    el.baro.value = inputs.baro;
    el.indAlt.value = inputs.indAlt;
    el.oat.value = inputs.oat;
  }

  // Reflect the "at/above 18,000 ft -> altimeter forced to 29.92" rule: the
  // altimeter field and its steppers are locked in the flight levels.
  function applyAltimeterLock() {
    const forced = PA46_CALC.altimeterIsForcedStandard(num(el.indAlt.value) || 0);
    if (forced) el.baro.value = PA46_CALC.STANDARD_ALTIMETER_INHG.toFixed(2);
    el.baro.disabled = forced;
    el.baroUp.disabled = forced;
    el.baroDown.disabled = forced;
    return forced;
  }

  // --- Compute + render results -------------------------------------------
  function fmtInt(n) { return Math.round(n).toLocaleString('en-US'); }
  function fmtMap(n) { return (Math.round(n * 10) / 10).toFixed(1); }
  function fmtFF(n) { return (Math.round(n * 10) / 10).toFixed(1); }

  // The standard OAT (rounded ISA) for the current pressure altitude.
  function standardOatC() {
    const indAlt = num(el.indAlt.value);
    const baro = num(el.baro.value);
    if (!Number.isFinite(indAlt) || !Number.isFinite(baro)) return null;
    return Math.round(PA46_DATA.isaTempC(PA46_CALC.pressureAltitude(indAlt, baro)));
  }

  function recompute() {
    applyAltimeterLock();

    const indAlt = num(el.indAlt.value);
    const baro = num(el.baro.value);
    const oat = num(el.oat.value);

    inputs.indAlt = indAlt;
    inputs.baro = baro;
    inputs.oat = oat;
    persistInputs();

    // Keep the native step in sync with the altitude range (500 vs 1000).
    if (Number.isFinite(indAlt)) el.indAlt.step = altStepUp(indAlt);

    if (![indAlt, baro, oat].every(Number.isFinite)) {
      el.infoLine.innerHTML = '&nbsp;';
      blankResults();
      return;
    }

    const result = PA46_CALC.solve(
      { indicatedAltFt: indAlt, altimeterInHg: baro, oatC: oat, powerKey: inputs.powerKey },
      activeAircraft()
    );
    lastSolve = result;

    // Any recompute cancels an in-progress "show indicated" peek.
    if (iasTimer) { clearTimeout(iasTimer); iasTimer = null; }
    el.tasLabel.textContent = 'Expected airspeed';
    el.speedCell.classList.remove('showing-ias');

    // Informational line under the pressure/temp inputs: pressure altitude
    // (omitted in the flight levels, where PA == assigned) plus ISA temp.
    const isaTxt = 'ISA ' + Math.round(result.isaTempC) + '°C';
    el.infoLine.textContent = result.altimeterForcedStandard
      ? 'Flight levels · ' + isaTxt
      : 'Pressure altitude ' + fmtInt(result.pressureAltFt) + ' ft · ' + isaTxt;

    el.rRPM.textContent = fmtInt(result.rpm);
    el.rMAP.innerHTML = fmtMap(result.manifoldPressureInHg) + '<span class="result-unit"> in Hg</span>';
    el.rFF.innerHTML = fmtFF(result.fuelFlow.totalGph) + '<span class="result-unit"> GPH</span>';

    if (result.tasKt == null) {
      // Holding has no published cruise-speed curve.
      el.rTAS.innerHTML = '<span class="result-na">Not Published</span>';
    } else {
      el.rTAS.innerHTML = fmtInt(result.tasKt) + '<span class="result-unit"> KTAS</span>';
    }

    // Warnings.
    el.warnings.innerHTML = '';
    for (const w of result.warnings) {
      const div = document.createElement('div');
      div.className = 'warning';
      div.textContent = w;
      el.warnings.appendChild(div);
    }
  }

  function blankResults() {
    lastSolve = null;
    el.rRPM.textContent = '—';
    el.rMAP.innerHTML = '—<span class="result-unit"> in Hg</span>';
    el.rFF.innerHTML = '—<span class="result-unit"> GPH</span>';
    el.rTAS.innerHTML = '—<span class="result-unit"> KTAS</span>';
    el.warnings.innerHTML = '';
  }

  // --- Manage-aircraft dialog ---------------------------------------------
  function typeLabel(typeId) {
    const t = PA46_DATA.AIRCRAFT_TYPES.find(function (x) { return x.id === typeId; });
    return t ? t.label : typeId;
  }

  function fmtBiasPct(p) {
    if (!p) return '±0%';
    return (p > 0 ? '+' : '') + (Math.round(p * 10) / 10) + '%';
  }

  function renderAircraftList() {
    el.aircraftList.innerHTML = '';
    for (const a of aircraft) {
      const row = document.createElement('div');
      row.className = 'aircraft-row';
      row.innerHTML =
        '<div class="ar-main">' +
          '<span class="ar-name">' + escapeHtml(a.name) + '</span>' +
          '<span class="ar-meta">' + escapeHtml(typeLabel(a.type)) + ' · ' + fmtBiasPct(a.biasPct) + '</span>' +
        '</div>' +
        (a.isDefault ? '<span class="ar-badge">DEFAULT</span>' : '');

      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'link-btn';
      edit.textContent = 'Edit';
      edit.addEventListener('click', function () { openEditor(a); });
      row.appendChild(edit);

      if (aircraft.length > 1) {
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'link-btn danger';
        del.textContent = 'Delete';
        del.addEventListener('click', function () { deleteAircraft(a.id); });
        row.appendChild(del);
      }
      el.aircraftList.appendChild(row);
    }
  }

  function populateTypeDropdown() {
    el.editType.innerHTML = '';
    for (const t of PA46_DATA.AIRCRAFT_TYPES) {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.label;
      el.editType.appendChild(opt);
    }
  }

  // Bias entry mode: 'pct' (direct percent) or 'kt' (knots @ altitude -> %).
  function setBiasMode(mode) {
    const pct = mode !== 'kt';
    el.biasPctRow.hidden = !pct;
    el.biasKtRow.hidden = pct;
    Array.prototype.forEach.call(el.biasMode.children, function (b) {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    updateBiasHelp();
  }

  // The percentage that will actually be saved, given the current mode/fields.
  function resolvedBiasPct() {
    if (el.biasKtRow.hidden) {
      return num(el.editBiasPct.value) || 0;
    }
    const kt = num(el.editBiasKt.value);
    const alt = num(el.editBiasAlt.value);
    if (!Number.isFinite(kt) || !Number.isFinite(alt)) return 0;
    return PA46_CALC.biasKtToPct(kt, alt);
  }

  function updateBiasHelp() {
    if (el.biasKtRow.hidden) {
      el.biasHelp.textContent = '+ if your airframe runs faster than book, − if slower. Applied as a uniform % at all altitudes.';
    } else {
      const pct = resolvedBiasPct();
      const ref = PA46_CALC.tasFromChart('75', num(el.editBiasAlt.value) || 0);
      el.biasHelp.textContent = 'Converted vs. 75% high-speed cruise (' +
        (ref ? Math.round(ref) + ' kt book' : '—') + ') → ' + fmtBiasPct(pct) +
        ', applied uniformly at all altitudes.';
    }
  }

  function openEditor(a) {
    el.editorTitle.textContent = a ? 'Edit aircraft' : 'Add aircraft';
    el.editId.value = a ? a.id : '';
    el.editType.value = a ? a.type : PA46_DATA.DEFAULT_AIRCRAFT_TYPE;
    el.editName.value = a ? a.name : '';
    el.editBiasPct.value = a ? (Math.round((a.biasPct || 0) * 10) / 10) : 0;
    el.editBiasKt.value = '';
    el.editBiasAlt.value = 18000;
    el.editDefault.checked = a ? !!a.isDefault : (aircraft.length === 0);
    setBiasMode('pct');
    el.editor.hidden = false;
    el.addAircraftBtn.hidden = true;
    el.editName.focus();
  }

  function closeEditor() {
    el.editor.hidden = true;
    el.addAircraftBtn.hidden = false;
  }

  function saveAircraft() {
    const id = el.editId.value || newId();
    const type = el.editType.value || PA46_DATA.DEFAULT_AIRCRAFT_TYPE;
    const name = (el.editName.value || '').trim() || 'Unnamed PA46';
    const biasPct = Math.round(resolvedBiasPct() * 100) / 100;
    const makeDefault = el.editDefault.checked;

    const existing = aircraft.find(a => a.id === id);
    if (existing) {
      existing.type = type;
      existing.name = name;
      existing.biasPct = biasPct;
    } else {
      aircraft.push({ id, type, name, biasPct, isDefault: false });
    }
    if (makeDefault) {
      aircraft.forEach(a => { a.isDefault = (a.id === id); });
    } else if (!aircraft.some(a => a.isDefault)) {
      aircraft[0].isDefault = true;
    }
    saveJSON(LS.aircraft, aircraft);

    renderAircraftPicker();
    renderAircraftList();
    closeEditor();
    recompute();
  }

  function deleteAircraft(id) {
    if (aircraft.length <= 1) return;
    const wasActive = id === activeId;
    aircraft = aircraft.filter(a => a.id !== id);
    if (!aircraft.some(a => a.isDefault)) aircraft[0].isDefault = true;
    if (wasActive) activeId = (aircraft.find(a => a.isDefault) || aircraft[0]).id;
    saveJSON(LS.aircraft, aircraft);
    saveJSON(LS.activeId, activeId);
    renderAircraftPicker();
    renderAircraftList();
    closeEditor();
    recompute();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // --- Events --------------------------------------------------------------
  el.aircraftSelect.addEventListener('change', function () {
    activeId = el.aircraftSelect.value;
    saveJSON(LS.activeId, activeId);
    recompute();
  });
  // As indicated altitude changes, shift OAT by the ISA lapse rate (2 C/1000 ft)
  // from its current value, so a re-assigned altitude keeps a realistic OAT.
  // A manual OAT edit becomes the new baseline automatically (we read the field).
  function adjustOatForAltitude(newAlt) {
    if (Number.isFinite(newAlt) && Number.isFinite(lastIndAlt) && newAlt !== lastIndAlt) {
      const curOat = num(el.oat.value);
      if (Number.isFinite(curOat)) {
        let o = Math.round(PA46_CALC.oatAfterAltitudeChange(curOat, lastIndAlt, newAlt));
        const omin = parseInt(el.oat.min, 10), omax = parseInt(el.oat.max, 10);
        if (Number.isFinite(omin)) o = Math.max(omin, o);
        if (Number.isFinite(omax)) o = Math.min(omax, o);
        el.oat.value = o;
      }
    }
    if (Number.isFinite(newAlt)) lastIndAlt = newAlt;
  }

  // Typing is still allowed on every field (bonus), but the app is fully usable
  // with the steppers / STD buttons alone — no keyboard required.
  el.baro.addEventListener('input', recompute);
  // Live typing updates results, but OAT only re-tracks once the altitude edit is
  // committed (blur/Enter) — otherwise intermediate keystrokes would thrash it.
  el.indAlt.addEventListener('input', recompute);
  el.indAlt.addEventListener('change', function () {
    adjustOatForAltitude(num(el.indAlt.value));
    recompute();
  });
  el.oat.addEventListener('input', recompute);

  function clampNum(v, minStr, maxStr, fbMin, fbMax) {
    const mn = parseFloat(minStr); const mx = parseFloat(maxStr);
    if (Number.isFinite(mn)) v = Math.max(mn, v); else v = Math.max(fbMin, v);
    if (Number.isFinite(mx)) v = Math.min(mx, v); else v = Math.min(fbMax, v);
    return v;
  }

  function stepAltitude(dir) {
    let v = num(el.indAlt.value);
    if (!Number.isFinite(v)) v = ALT_STEP_BREAK;
    v = dir > 0 ? v + altStepUp(v) : v - altStepDown(v);
    v = clampNum(v, el.indAlt.min, el.indAlt.max, 0, 30000);
    el.indAlt.value = v;
    adjustOatForAltitude(v);
    recompute();
  }
  function stepBaro(dir) {
    if (el.baro.disabled) return;
    let v = num(el.baro.value);
    if (!Number.isFinite(v)) v = PA46_CALC.STANDARD_ALTIMETER_INHG;
    v = Math.round((v + dir * 0.01) * 100) / 100;
    v = clampNum(v, el.baro.min, el.baro.max, 27, 32);
    el.baro.value = v.toFixed(2);
    recompute();
  }
  function stepOat(dir) {
    let v = num(el.oat.value);
    if (!Number.isFinite(v)) v = 0;
    v = clampNum(v + dir, el.oat.min, el.oat.max, -60, 50);
    el.oat.value = v;
    recompute();
  }

  // Press-and-hold auto-repeat for any stepper button (Note 15). A quick tap
  // fires once; holding starts repeating after a short delay. Keyboard fires once.
  function attachRepeat(btn, fn) {
    let delay = null, iv = null;
    function stop() {
      if (delay) { clearTimeout(delay); delay = null; }
      if (iv) { clearInterval(iv); iv = null; }
    }
    btn.addEventListener('pointerdown', function (e) {
      if (btn.disabled) return;
      e.preventDefault();
      fn();
      delay = setTimeout(function () {
        iv = setInterval(function () {
          if (btn.disabled) { stop(); return; }
          fn();
        }, 90);
      }, 400);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) {
      btn.addEventListener(ev, stop);
    });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!btn.disabled) fn(); }
    });
  }
  attachRepeat(el.altUp, function () { stepAltitude(1); });
  attachRepeat(el.altDown, function () { stepAltitude(-1); });
  attachRepeat(el.baroUp, function () { stepBaro(1); });
  attachRepeat(el.baroDown, function () { stepBaro(-1); });
  attachRepeat(el.oatUp, function () { stepOat(1); });
  attachRepeat(el.oatDown, function () { stepOat(-1); });

  // Tap the altimeter / OAT value to reset it to standard (the value itself is
  // the button — no keyboard, since the fields are readonly).
  el.baro.addEventListener('click', function () {
    if (el.baro.disabled) return;      // locked in the flight levels
    el.baro.value = PA46_CALC.STANDARD_ALTIMETER_INHG.toFixed(2);
    recompute();
  });
  el.oat.addEventListener('click', function () {
    const s = standardOatC();
    if (s == null) return;
    el.oat.value = s;
    recompute();
  });

  // Tap the expected airspeed to peek at estimated INDICATED airspeed for a few
  // seconds (handy for checking the airspeed indicator's calibration).
  el.speedCell.addEventListener('click', function () {
    if (!lastSolve || lastSolve.tasKt == null) return;
    const ias = PA46_CALC.tasToIas(lastSolve.tasKt, lastSolve.pressureAltFt, inputs.oat);
    el.tasLabel.textContent = 'Indicated (est.)';
    el.rTAS.innerHTML = fmtInt(ias) + '<span class="result-unit"> KIAS</span>';
    el.speedCell.classList.add('showing-ias');
    if (iasTimer) clearTimeout(iasTimer);
    iasTimer = setTimeout(recompute, 3500);   // recompute reverts to TAS
  });

  el.manageBtn.addEventListener('click', function () {
    renderAircraftList();
    closeEditor();
    if (typeof el.dialog.showModal === 'function') el.dialog.showModal();
    else el.dialog.setAttribute('open', '');
  });
  el.addAircraftBtn.addEventListener('click', function () { openEditor(null); });
  el.saveAircraftBtn.addEventListener('click', saveAircraft);
  el.cancelEditBtn.addEventListener('click', closeEditor);
  el.closeDialogBtn.addEventListener('click', function () {
    if (typeof el.dialog.close === 'function') el.dialog.close();
    else el.dialog.removeAttribute('open');
  });

  // Bias mode toggle + live conversion help.
  Array.prototype.forEach.call(el.biasMode.children, function (b) {
    b.addEventListener('click', function () { setBiasMode(b.dataset.mode); });
  });
  el.editBiasKt.addEventListener('input', updateBiasHelp);
  el.editBiasAlt.addEventListener('input', updateBiasHelp);

  populateTypeDropdown();

  // --- Init ----------------------------------------------------------------
  renderAircraftPicker();
  renderPowerButtons();
  syncInputsToFields();
  recompute();

  // Service worker for offline use.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* ignore */ });
    });
  }
})();
