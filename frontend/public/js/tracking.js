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
        ${inst.real_sowing_date ? `<span>🌱 Semis: ${inst.real_sowing_date}</span>` : ''}
        ${inst.real_transplant_date ? `<span>🔄 Repiquage: ${inst.real_transplant_date}</span>` : ''}
        ${inst.real_planting_date ? `<span>⬇️ Plantation: ${inst.real_planting_date}</span>` : ''}
        ${inst.real_harvest_date ? `<span>🌾 Récolte: ${inst.real_harvest_date}</span>` : ''}
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
    const form = document.getElementById('instance-form');
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