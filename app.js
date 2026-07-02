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
    aircraft = [{ id: newId(), name: 'My PA46-310P', airframeBiasKt: 0, isDefault: true }];
    saveJSON(LS.aircraft, aircraft);
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

  // --- Elements ------------------------------------------------------------
  const el = {
    aircraftSelect: document.getElementById('aircraftSelect'),
    manageBtn: document.getElementById('manageBtn'),
    baro: document.getElementById('baro'),
    baroHint: document.getElementById('baroHint'),
    indAlt: document.getElementById('indAlt'),
    altUp: document.getElementById('altUp'),
    altDown: document.getElementById('altDown'),
    oat: document.getElementById('oat'),
    oatHint: document.getElementById('oatHint'),
    powerButtons: document.getElementById('powerButtons'),
    rPA: document.getElementById('rPA'),
    rRPM: document.getElementById('rRPM'),
    rMAP: document.getElementById('rMAP'),
    rFF: document.getElementById('rFF'),
    rTAS: document.getElementById('rTAS'),
    warnings: document.getElementById('warnings'),
    // dialog
    dialog: document.getElementById('manageDialog'),
    aircraftList: document.getElementById('aircraftList'),
    editId: document.getElementById('editId'),
    editName: document.getElementById('editName'),
    editBias: document.getElementById('editBias'),
    editDefault: document.getElementById('editDefault'),
    editorTitle: document.getElementById('editorTitle'),
    saveAircraftBtn: document.getElementById('saveAircraftBtn'),
    newAircraftBtn: document.getElementById('newAircraftBtn'),
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
  function rpmRangeLabel(setting) {
    const rpms = setting.rpmOptions.map(o => o.rpm);
    const lo = Math.min.apply(null, rpms);
    const hi = Math.max.apply(null, rpms);
    return lo === hi ? (lo + ' RPM') : (lo + '–' + hi + ' RPM');
  }

  function renderPowerButtons() {
    el.powerButtons.innerHTML = '';
    for (const key of PA46_DATA.POWER_ORDER) {
      const s = PA46_DATA.POWER_SETTINGS[key];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'power-btn' + (key === inputs.powerKey ? ' active' : '');
      btn.dataset.key = key;
      const title = s.percent ? (s.label + ' (' + s.percent + '%)') : s.label;
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

  // Reflect the "above 18,000 ft -> altimeter forced to 29.92" rule in the UI.
  function applyAltimeterLock() {
    const forced = PA46_CALC.altimeterIsForcedStandard(num(el.indAlt.value) || 0);
    if (forced) {
      el.baro.value = PA46_CALC.STANDARD_ALTIMETER_INHG.toFixed(2);
      el.baro.disabled = true;
      el.baroHint.textContent = 'Above 18,000 ft — altimeter set to 29.92 (standard).';
    } else {
      el.baro.disabled = false;
      el.baroHint.innerHTML = '&nbsp;';
    }
  }

  // --- Compute + render results -------------------------------------------
  function fmtInt(n) { return Math.round(n).toLocaleString('en-US'); }
  function fmtMap(n) { return (Math.round(n * 10) / 10).toFixed(1); }
  function fmtFF(n) { return (Math.round(n * 10) / 10).toFixed(1); }

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

    // OAT hint: show the ISA standard temp at this pressure altitude.
    if (Number.isFinite(indAlt) && Number.isFinite(baro)) {
      const pa = PA46_CALC.pressureAltitude(indAlt, baro);
      const isa = PA46_DATA.isaTempC(pa);
      el.oatHint.textContent = 'ISA standard at this altitude: ' + Math.round(isa) + '°C';
    } else {
      el.oatHint.innerHTML = '&nbsp;';
    }

    if (![indAlt, baro, oat].every(Number.isFinite)) {
      blankResults();
      return;
    }

    const result = PA46_CALC.solve(
      { indicatedAltFt: indAlt, altimeterInHg: baro, oatC: oat, powerKey: inputs.powerKey },
      activeAircraft()
    );

    el.rPA.textContent = fmtInt(result.pressureAltFt) + ' ft';
    el.rRPM.textContent = fmtInt(result.rpm);
    el.rMAP.innerHTML = fmtMap(result.manifoldPressureInHg) + '<span class="result-unit"> in Hg</span>';
    el.rFF.innerHTML = fmtFF(result.fuelFlow.totalGph) + '<span class="result-unit"> GPH</span>';

    if (result.tasKt == null) {
      el.rTAS.innerHTML = '—<span class="result-unit"> KTAS</span>';
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
    el.rPA.textContent = '—';
    el.rRPM.textContent = '—';
    el.rMAP.innerHTML = '—<span class="result-unit"> in Hg</span>';
    el.rFF.innerHTML = '—<span class="result-unit"> GPH</span>';
    el.rTAS.innerHTML = '—<span class="result-unit"> KTAS</span>';
    el.warnings.innerHTML = '';
  }

  // --- Manage-aircraft dialog ---------------------------------------------
  function renderAircraftList() {
    el.aircraftList.innerHTML = '';
    for (const a of aircraft) {
      const row = document.createElement('div');
      row.className = 'aircraft-row';
      const bias = a.airframeBiasKt ? ((a.airframeBiasKt > 0 ? '+' : '') + a.airframeBiasKt + ' kt') : '±0 kt';
      row.innerHTML =
        '<span class="ar-name">' + escapeHtml(a.name) + '</span>' +
        (a.isDefault ? '<span class="ar-badge">DEFAULT</span>' : '') +
        '<span class="ar-bias">' + bias + '</span>';

      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'link-btn';
      edit.textContent = 'Edit';
      edit.addEventListener('click', function () { fillEditor(a); });
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

  function fillEditor(a) {
    el.editorTitle.textContent = a ? 'Edit aircraft' : 'Add aircraft';
    el.editId.value = a ? a.id : '';
    el.editName.value = a ? a.name : '';
    el.editBias.value = a ? a.airframeBiasKt : 0;
    el.editDefault.checked = a ? !!a.isDefault : false;
  }

  function saveAircraft() {
    const id = el.editId.value || newId();
    const name = (el.editName.value || '').trim() || 'Unnamed PA46';
    const bias = num(el.editBias.value) || 0;
    const makeDefault = el.editDefault.checked;

    const existing = aircraft.find(a => a.id === id);
    if (existing) {
      existing.name = name;
      existing.airframeBiasKt = bias;
    } else {
      aircraft.push({ id, name, airframeBiasKt: bias, isDefault: false });
    }
    if (makeDefault) {
      aircraft.forEach(a => { a.isDefault = (a.id === id); });
    } else if (!aircraft.some(a => a.isDefault)) {
      aircraft[0].isDefault = true;
    }
    saveJSON(LS.aircraft, aircraft);

    // If the edited aircraft is active, its bias change should recompute.
    if (id === activeId || makeDefault) {
      if (makeDefault) { /* keep current active as-is */ }
    }
    renderAircraftPicker();
    renderAircraftList();
    fillEditor(null);
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
    fillEditor(null);
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
  el.baro.addEventListener('input', recompute);
  el.indAlt.addEventListener('input', recompute);
  el.oat.addEventListener('input', recompute);

  function stepAltitude(dir) {
    let v = num(el.indAlt.value);
    if (!Number.isFinite(v)) v = ALT_STEP_BREAK;
    v = dir > 0 ? v + altStepUp(v) : v - altStepDown(v);
    const min = parseInt(el.indAlt.min, 10) || 0;
    const max = parseInt(el.indAlt.max, 10) || 30000;
    v = Math.max(min, Math.min(max, v));
    el.indAlt.value = v;
    recompute();
  }
  el.altUp.addEventListener('click', function () { stepAltitude(1); });
  el.altDown.addEventListener('click', function () { stepAltitude(-1); });

  el.manageBtn.addEventListener('click', function () {
    renderAircraftList();
    fillEditor(null);
    if (typeof el.dialog.showModal === 'function') el.dialog.showModal();
    else el.dialog.setAttribute('open', '');
  });
  el.saveAircraftBtn.addEventListener('click', saveAircraft);
  el.newAircraftBtn.addEventListener('click', function () { fillEditor(null); });
  el.closeDialogBtn.addEventListener('click', function () {
    if (typeof el.dialog.close === 'function') el.dialog.close();
    else el.dialog.removeAttribute('open');
  });

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
