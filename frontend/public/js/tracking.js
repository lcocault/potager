// ============================================================
// Tracking module – Real cultivation execution tracking
// ============================================================
import { cropInstancesApi, cropPathsApi, gridApi, } from './api.js';
const STATUS_LABELS = {
    planifie: '📋 Planifié',
    en_cours: '🌱 En cours',
    termine: '✅ Terminé',
    abandonne: '❌ Abandonné',
};
const STATUS_COLORS = {
    planifie: '#2196f3',
    en_cours: '#4caf50',
    termine: '#9e9e9e',
    abandonne: '#f44336',
};
const state = {
    instances: [],
    paths: [],
    layout: null,
    selectedCells: new Set(),
    viewDate: new Date().toISOString().substring(0, 10),
};
export async function initTracking(container) {
    container.innerHTML = `
    <div class="module-header">
      <h2>🌿 Suivi des cultures</h2>
      <div class="toolbar">
        <label>Date de visualisation :
          <input type="date" id="view-date" value="${state.viewDate}">
        </label>
        <button id="btn-add-instance" class="btn btn-primary">+ Nouvelle culture</button>
      </div>
    </div>
    <div class="tracking-layout">
      <div id="instances-list" class="instances-list"></div>
      <div id="tracking-grid-wrapper" class="tracking-grid-wrapper">
        <h3>Vue du terrain au <span id="date-display">${state.viewDate}</span></h3>
        <canvas id="tracking-canvas"></canvas>
        <div id="tracking-legend" class="tracking-legend">
          ${Object.entries(STATUS_LABELS).map(([k, v]) => `<span class="legend-badge" style="background:${STATUS_COLORS[k]}">${v}</span>`).join('')}
        </div>
      </div>
    </div>
    <div id="instance-modal" class="modal hidden"></div>
  `;
    await loadData();
    renderInstances();
    await renderTrackingGrid();
    bindTrackingEvents(container);
}
async function loadData() {
    [state.instances, state.paths] = await Promise.all([
        cropInstancesApi.list(),
        cropPathsApi.list(),
    ]);
    const layouts = await gridApi.list();
    if (layouts.length > 0) {
        state.layout = await gridApi.get(layouts[0].id);
    }
}
function renderInstances() {
    const list = document.getElementById('instances-list');
    if (state.instances.length === 0) {
        list.innerHTML = '<p class="empty-state">Aucune culture. Cliquez sur "+ Nouvelle culture".</p>';
        return;
    }
    list.innerHTML = state.instances.map((inst) => `
    <div class="instance-card status-${inst.status}" data-id="${inst.id}">
      <div class="instance-header">
        <span class="instance-icon">${inst.species_icon ?? '🌱'}</span>
        <span class="instance-name">${escHtml(inst.species_name)} – ${escHtml(inst.path_name)}</span>
        <span class="status-badge" style="background:${STATUS_COLORS[inst.status]}">${STATUS_LABELS[inst.status]}</span>
      </div>
      <div class="instance-dates">
        ${renderDateRow('🌱', 'Semis', inst.real_sowing_date, inst.sowing_date)}
        ${renderDateRow('🔄', 'Repiquage', inst.real_transplant_date, inst.transplant_date)}
        ${renderDateRow('⬇️', 'Plantation', inst.real_planting_date, inst.planting_date)}
        ${renderDateRow('🌾', 'Récolte', inst.real_harvest_date, inst.harvest_date)}
      </div>
      <div class="instance-actions">
        <button class="btn-icon btn-edit-instance" data-id="${inst.id}" title="Modifier">✏️</button>
        <button class="btn-icon btn-delete-instance" data-id="${inst.id}" title="Supprimer">🗑️</button>
      </div>
    </div>
  `).join('');
    list.querySelectorAll('.btn-edit-instance').forEach((btn) => {
        btn.addEventListener('click', () => openInstanceModal(Number(btn.dataset.id)));
    });
    list.querySelectorAll('.btn-delete-instance').forEach((btn) => {
        btn.addEventListener('click', () => deleteInstance(Number(btn.dataset.id)));
    });
}
/**
 * Render a single date row showing the real date and the theoretical MM-DD alongside.
 * If the real date differs from what the itinerary predicted, both are shown.
 */
function renderDateRow(icon, label, realDate, theoreticalMmDd) {
    if (!realDate && !theoreticalMmDd)
        return '';
    if (realDate) {
        const theoretical = theoreticalMmDd ? formatMmDd(theoreticalMmDd) : null;
        const realFormatted = new Date(realDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
        const hint = theoretical && realDate.substring(5) !== theoreticalMmDd
            ? ` <span class="theoretical-date">(théorique : ${theoretical})</span>`
            : '';
        return `<span>${icon} ${label}: ${realFormatted}${hint}</span>`;
    }
    // No real date but itinerary provides a theoretical date
    return `<span class="theoretical-only">${icon} ${label}: <span class="theoretical-date">${formatMmDd(theoreticalMmDd)}</span> (théorique)</span>`;
}
/** Format a MM-DD string to a short human-readable date (e.g. "03-15" → "15 mars") */
function formatMmDd(mmdd) {
    const d = new Date(`2001-${mmdd}`);
    return d.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
}
async function renderTrackingGrid() {
    if (!state.layout)
        return;
    const canvas = document.getElementById('tracking-canvas');
    const CELL = 28;
    canvas.width = state.layout.cols * CELL;
    canvas.height = state.layout.rows * CELL;
    const cropCells = await gridApi.getCrops(state.layout.id, state.viewDate);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw all cells
    (state.layout.cells ?? []).forEach((c) => {
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(c.col * CELL, c.row * CELL, CELL, CELL);
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.strokeRect(c.col * CELL, c.row * CELL, CELL, CELL);
    });
    // Overlay active crops
    cropCells.forEach((c) => {
        if (!c.status)
            return;
        const color = STATUS_COLORS[c.status] ?? '#4caf50';
        ctx.fillStyle = color + 'aa'; // semi-transparent
        ctx.fillRect(c.col * CELL, c.row * CELL, CELL, CELL);
        if (c.species_icon) {
            ctx.font = `${CELL * 0.6}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(c.species_icon, c.col * CELL + CELL / 2, c.row * CELL + CELL / 2);
        }
    });
    document.getElementById('date-display').textContent = state.viewDate;
}
function openAddInstanceModal() {
    openInstanceModal(null);
}
async function openInstanceModal(id) {
    let instance = null;
    if (id !== null) {
        instance = await cropInstancesApi.get(id);
    }
    const modal = document.getElementById('instance-modal');
    modal.classList.remove('hidden');
    const pathOptions = state.paths
        .map((p) => `<option value="${p.id}" ${instance?.crop_path_id === p.id ? 'selected' : ''}>${p.species_icon ?? '🌱'} ${escHtml(p.species_name)} – ${escHtml(p.name)}</option>`)
        .join('');
    const statusOptions = Object.entries(STATUS_LABELS)
        .map(([v, l]) => `<option value="${v}" ${instance?.status === v ? 'selected' : ''}>${l}</option>`)
        .join('');
    modal.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-box">
        <h3>${instance ? 'Modifier' : 'Nouvelle'} culture</h3>
        <form id="instance-form">
          <label>Itinéraire *
            <select name="crop_path_id" required>${pathOptions}</select>
          </label>
          <label>Statut
            <select name="status">${statusOptions}</select>
          </label>
          <label>Date de début réelle
            <input name="start_date" type="date" value="${instance?.start_date ?? ''}"
                   title="Date de début effective (les autres dates seront calculées automatiquement)">
            <small>Les dates réelles sont calculées automatiquement d'après l'itinéraire.</small>
          </label>
          <label>Date de semis réel
            <input name="real_sowing_date" type="date" value="${instance?.real_sowing_date ?? ''}">
          </label>
          <label>Date de repiquage réel
            <input name="real_transplant_date" type="date" value="${instance?.real_transplant_date ?? ''}">
          </label>
          <label>Date de plantation réelle
            <input name="real_planting_date" type="date" value="${instance?.real_planting_date ?? ''}">
          </label>
          <label>Date de récolte réelle
            <input name="real_harvest_date" type="date" value="${instance?.real_harvest_date ?? ''}">
          </label>
          <label>Notes
            <textarea name="notes">${escHtml(instance?.notes ?? '')}</textarea>
          </label>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">${instance ? 'Enregistrer' : 'Créer'}</button>
            <button type="button" id="btn-modal-cancel" class="btn btn-secondary">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  `;
    document.getElementById('btn-modal-cancel').addEventListener('click', closeModal);
    // When itinerary or start_date changes, preview the calculated dates client-side
    const form = document.getElementById('instance-form');
    const pathSelect = form.querySelector('[name="crop_path_id"]');
    const startInput = form.querySelector('[name="start_date"]');
    const previewDates = () => {
        const pathId = Number(pathSelect.value);
        const startDate = startInput.value;
        if (!pathId || !startDate)
            return;
        const path = state.paths.find((p) => p.id === pathId);
        if (!path)
            return;
        const calculated = calcDatesFromStart(path, startDate);
        const fill = (name, val) => {
            const el = form.querySelector(`[name="${name}"]`);
            if (el && !el.value) {
                el.value = val ?? '';
            }
        };
        fill('real_sowing_date', calculated.real_sowing_date);
        fill('real_transplant_date', calculated.real_transplant_date);
        fill('real_planting_date', calculated.real_planting_date);
        fill('real_harvest_date', calculated.real_harvest_date);
    };
    pathSelect.addEventListener('change', previewDates);
    startInput.addEventListener('change', previewDates);
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const data = {};
        fd.forEach((v, k) => { data[k] = v.toString() || null; });
        try {
            if (instance) {
                const updated = await cropInstancesApi.update(instance.id, data);
                state.instances = state.instances.map((i) => (i.id === updated.id ? updated : i));
            }
            else {
                const created = await cropInstancesApi.create(data);
                state.instances.push(created);
            }
            renderInstances();
            await renderTrackingGrid();
            closeModal();
        }
        catch (err) {
            alert('Erreur : ' + err.message);
        }
    });
}
/**
 * Client-side preview: compute real dates from an itinerary and a start date.
 * Mirrors the server-side logic in CropInstancesController::applyStartDate().
 */
function calcDatesFromStart(path, startDateStr) {
    const startDate = new Date(startDateStr);
    const year = startDate.getFullYear();
    const addDays = (d, days) => {
        const r = new Date(d);
        r.setDate(r.getDate() + days);
        return r;
    };
    const toIso = (d) => d.toISOString().substring(0, 10);
    let offsetDays = 0;
    if (path.sowing_date) {
        const anchor = new Date(`${year}-${path.sowing_date}`);
        offsetDays = Math.round((startDate.getTime() - anchor.getTime()) / 86400000);
    }
    const calcDate = (mmdd) => {
        if (!mmdd)
            return null;
        const base = new Date(`${year}-${mmdd}`);
        return toIso(addDays(base, offsetDays));
    };
    return {
        real_sowing_date: calcDate(path.sowing_date),
        real_transplant_date: calcDate(path.transplant_date),
        real_planting_date: calcDate(path.planting_date),
        real_harvest_date: calcDate(path.harvest_date),
    };
}
function closeModal() {
    const modal = document.getElementById('instance-modal');
    modal.classList.add('hidden');
    modal.innerHTML = '';
}
async function deleteInstance(id) {
    if (!confirm('Supprimer cette culture ?'))
        return;
    try {
        await cropInstancesApi.delete(id);
        state.instances = state.instances.filter((i) => i.id !== id);
        renderInstances();
        await renderTrackingGrid();
    }
    catch (err) {
        alert('Erreur : ' + err.message);
    }
}
function bindTrackingEvents(container) {
    container.querySelector('#btn-add-instance')?.addEventListener('click', openAddInstanceModal);
    container.querySelector('#view-date')?.addEventListener('change', async (e) => {
        state.viewDate = e.target.value;
        await renderTrackingGrid();
    });
}
function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
//# sourceMappingURL=tracking.js.map