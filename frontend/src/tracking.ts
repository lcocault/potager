// ============================================================
// Tracking module – Real cultivation execution tracking
// ============================================================
import {
  cropInstancesApi, cropPathsApi, gridApi,
  CropInstance, CropPath, GridLayout, GridCell, CropStatus,
  CELL_TYPE_COLORS,
} from './api.js';

const STATUS_LABELS: Record<CropStatus, string> = {
  planifie:  '📋 Planifié',
  en_cours:  '🌱 En cours',
  termine:   '✅ Terminé',
  abandonne: '❌ Abandonné',
};

const STATUS_COLORS: Record<CropStatus, string> = {
  planifie:  '#2196f3',
  en_cours:  '#4caf50',
  termine:   '#9e9e9e',
  abandonne: '#f44336',
};

interface TrackingState {
  instances: CropInstance[];
  paths:     CropPath[];
  layout:    GridLayout | null;
  selectedCells: Set<number>;
  viewDate:  string;
}

const state: TrackingState = {
  instances:     [],
  paths:         [],
  layout:        null,
  selectedCells: new Set(),
  viewDate:      new Date().toISOString().substring(0, 10),
};

export async function initTracking(container: HTMLElement): Promise<void> {
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
          ${Object.entries(STATUS_LABELS).map(([k, v]) =>
            `<span class="legend-badge" style="background:${STATUS_COLORS[k as CropStatus]}">${v}</span>`
          ).join('')}
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

async function loadData(): Promise<void> {
  [state.instances, state.paths] = await Promise.all([
    cropInstancesApi.list(),
    cropPathsApi.list(),
  ]);
  const layouts = await gridApi.list();
  if (layouts.length > 0) {
    state.layout = await gridApi.get(layouts[0].id);
  }
}

function renderInstances(): void {
  const list = document.getElementById('instances-list')!;
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
        ${renderDateRow('🌱', 'Semis',      inst.real_sowing_date,     inst.sowing_date)}
        ${renderDateRow('🔄', 'Repiquage',  inst.real_transplant_date, inst.transplant_date)}
        ${renderDateRow('⬇️', 'Plantation', inst.real_planting_date,   inst.planting_date)}
        ${renderDateRow('🌾', 'Récolte',    inst.real_harvest_date,    inst.harvest_date)}
      </div>
      <div class="instance-actions">
        <button class="btn-icon btn-edit-instance" data-id="${inst.id}" title="Modifier">✏️</button>
        <button class="btn-icon btn-delete-instance" data-id="${inst.id}" title="Supprimer">🗑️</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll<HTMLButtonElement>('.btn-edit-instance').forEach((btn) => {
    btn.addEventListener('click', () => openInstanceModal(Number(btn.dataset.id)));
  });
  list.querySelectorAll<HTMLButtonElement>('.btn-delete-instance').forEach((btn) => {
    btn.addEventListener('click', () => deleteInstance(Number(btn.dataset.id)));
  });
}

/**
 * Render a single date row showing the real date and the theoretical MM-DD alongside.
 * If the real date differs from what the itinerary predicted, both are shown.
 */
function renderDateRow(
  icon: string,
  label: string,
  realDate: string | null,
  theoreticalMmDd: string | null
): string {
  if (!realDate && !theoreticalMmDd) return '';

  if (realDate) {
    const theoretical = theoreticalMmDd ? formatMmDd(theoreticalMmDd) : null;
    const realFormatted = new Date(realDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    const hint = theoretical && realDate.substring(5) !== theoreticalMmDd
      ? ` <span class="theoretical-date">(théorique : ${theoretical})</span>`
      : '';
    return `<span>${icon} ${label}: ${realFormatted}${hint}</span>`;
  }

  // No real date but itinerary provides a theoretical date
  return `<span class="theoretical-only">${icon} ${label}: <span class="theoretical-date">${formatMmDd(theoreticalMmDd!)}</span> (théorique)</span>`;
}

/** Format a MM-DD string to a short human-readable date (e.g. "03-15" → "15 mars") */
function formatMmDd(mmdd: string): string {
  const d = new Date(`2001-${mmdd}`);
  return d.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
}

async function renderTrackingGrid(): Promise<void> {
  if (!state.layout) return;
  const canvas = document.getElementById('tracking-canvas') as HTMLCanvasElement;
  const CELL   = 28;

  canvas.width  = state.layout.cols * CELL;
  canvas.height = state.layout.rows * CELL;

  const cropCells = await gridApi.getCrops(state.layout.id, state.viewDate);
  const ctx       = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw all cells
  (state.layout.cells ?? []).forEach((c) => {
    ctx.fillStyle   = '#f5f5f5';
    ctx.fillRect(c.col * CELL, c.row * CELL, CELL, CELL);
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.strokeRect(c.col * CELL, c.row * CELL, CELL, CELL);
  });

  // Overlay active crops
  cropCells.forEach((c: any) => {
    if (!c.status) return;
    const color = STATUS_COLORS[c.status as CropStatus] ?? '#4caf50';
    ctx.fillStyle = color + 'aa'; // semi-transparent
    ctx.fillRect(c.col * CELL, c.row * CELL, CELL, CELL);
    if (c.species_icon) {
      ctx.font      = `${CELL * 0.6}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(c.species_icon, c.col * CELL + CELL / 2, c.row * CELL + CELL / 2);
    }
  });

  document.getElementById('date-display')!.textContent = state.viewDate;
}

function openAddInstanceModal(): void {
  openInstanceModal(null);
}

async function openInstanceModal(id: number | null): Promise<void> {
  let instance: CropInstance | null = null;
  if (id !== null) {
    instance = await cropInstancesApi.get(id);
  }

  // Collect currently assigned cell IDs (pre-populated from the instance)
  const selectedCells = new Set<number>((instance?.cells ?? []).map((c) => c.id));

  const modal = document.getElementById('instance-modal')!;
  modal.classList.remove('hidden');

  const pathOptions = state.paths
    .map((p) => `<option value="${p.id}" ${instance?.crop_path_id === p.id ? 'selected' : ''}>${p.species_icon ?? '🌱'} ${escHtml(p.species_name)} – ${escHtml(p.name)}</option>`)
    .join('');

  const statusOptions = (Object.entries(STATUS_LABELS) as [CropStatus, string][])
    .map(([v, l]) => `<option value="${v}" ${instance?.status === v ? 'selected' : ''}>${l}</option>`)
    .join('');

  const hasCells = state.layout && (state.layout.cells ?? []).length > 0;
  const cellSectionHtml = state.layout
    ? `<div class="cell-assignment-section">
         <span class="cell-assignment-label">Cellules affectées au plan</span>
         ${hasCells
           ? `<small class="cell-assignment-hint">Cliquez ou glissez sur les cellules pour les affecter à cette culture.</small>
              <div class="cell-selection-canvas-wrapper">
                <canvas id="cell-selection-canvas"></canvas>
              </div>
              <small id="cell-selection-count" class="cell-selection-count">${selectedCells.size} cellule(s) sélectionnée(s)</small>`
           : `<small class="cell-assignment-hint">Le plan ne contient pas encore de cellules. Dessinez d'abord votre terrain dans l'onglet "Plan du terrain".</small>`
         }
       </div>`
    : `<div class="cell-assignment-section">
         <span class="cell-assignment-label">Cellules affectées au plan</span>
         <small class="cell-assignment-hint">Aucun plan disponible. Créez d'abord un plan dans l'onglet "Plan du terrain".</small>
       </div>`;

  modal.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-box modal-box-wide">
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
          ${cellSectionHtml}
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">${instance ? 'Enregistrer' : 'Créer'}</button>
            <button type="button" id="btn-modal-cancel" class="btn btn-secondary">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('btn-modal-cancel')!.addEventListener('click', closeModal);

  // Initialize interactive cell selector if a layout with cells is available
  if (hasCells) {
    const cellCanvas = document.getElementById('cell-selection-canvas') as HTMLCanvasElement;
    initCellSelector(state.layout!, selectedCells, cellCanvas);
  }

  // When itinerary or start_date changes, preview the calculated dates client-side
  const form = document.getElementById('instance-form') as HTMLFormElement;
  const pathSelect  = form.querySelector<HTMLSelectElement>('[name="crop_path_id"]')!;
  const startInput  = form.querySelector<HTMLInputElement>('[name="start_date"]')!;

  const previewDates = () => {
    const pathId    = Number(pathSelect.value);
    const startDate = startInput.value;
    if (!pathId || !startDate) return;

    const path = state.paths.find((p) => p.id === pathId);
    if (!path) return;

    const calculated = calcDatesFromStart(path, startDate);

    const fill = (name: string, val: string | null) => {
      const el = form.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
      if (el && !el.value) {
        el.value = val ?? '';
      }
    };
    fill('real_sowing_date',     calculated.real_sowing_date);
    fill('real_transplant_date', calculated.real_transplant_date);
    fill('real_planting_date',   calculated.real_planting_date);
    fill('real_harvest_date',    calculated.real_harvest_date);
  };

  pathSelect.addEventListener('change', () => {
    // On itinerary selection, initialize start_date from the itinerary's sowing date
    // (current year) when no start date has been entered yet.
    if (!startInput.value) {
      const path = state.paths.find((p) => p.id === Number(pathSelect.value));
      if (path) {
        const currentYear = new Date().getFullYear();
        const anchorMmDd = path.sowing_date ?? path.transplant_date ?? path.planting_date ?? path.harvest_date;
        if (anchorMmDd) {
          startInput.value = `${currentYear}-${anchorMmDd}`;
        }
      }
    }
    previewDates();
  });
  startInput.addEventListener('change', previewDates);

  // Trigger initial date preview when the modal first opens.
  // If no start_date is set yet (new instance or instance without a start date),
  // auto-fill it from the currently selected itinerary before previewing.
  if (!startInput.value && pathSelect.value) {
    const path = state.paths.find((p) => p.id === Number(pathSelect.value));
    if (path) {
      const currentYear = new Date().getFullYear();
      const anchorMmDd = path.sowing_date ?? path.transplant_date ?? path.planting_date ?? path.harvest_date;
      if (anchorMmDd) {
        startInput.value = `${currentYear}-${anchorMmDd}`;
      }
    }
  }
  previewDates();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd   = new FormData(form);
    const data: Record<string, any> = {};
    fd.forEach((v, k) => { data[k] = v.toString() || null; });
    data['cell_ids'] = Array.from(selectedCells);

    try {
      if (instance) {
        const updated = await cropInstancesApi.update(instance.id, data);
        state.instances = state.instances.map((i) => (i.id === updated.id ? updated : i));
      } else {
        const created = await cropInstancesApi.create(data);
        state.instances.push(created);
      }
      renderInstances();
      await renderTrackingGrid();
      closeModal();
    } catch (err: any) {
      alert('Erreur : ' + err.message);
    }
  });
}

/**
 * Client-side preview: compute real dates from an itinerary and a start date.
 * Mirrors the server-side logic in CropInstancesController::applyStartDate().
 */
function calcDatesFromStart(
  path: CropPath,
  startDateStr: string
): { real_sowing_date: string | null; real_transplant_date: string | null; real_planting_date: string | null; real_harvest_date: string | null } {
  const startDate = new Date(startDateStr);
  const year = startDate.getFullYear();

  const addDays = (d: Date, days: number): Date => {
    const r = new Date(d);
    r.setDate(r.getDate() + days);
    return r;
  };

  const toIso = (d: Date): string => d.toISOString().substring(0, 10);

  let offsetDays = 0;
  if (path.sowing_date) {
    const anchor = new Date(`${year}-${path.sowing_date}`);
    offsetDays = Math.round((startDate.getTime() - anchor.getTime()) / 86_400_000);
  }

  const calcDate = (mmdd: string | null): string | null => {
    if (!mmdd) return null;
    const base = new Date(`${year}-${mmdd}`);
    return toIso(addDays(base, offsetDays));
  };

  return {
    real_sowing_date:     calcDate(path.sowing_date),
    real_transplant_date: calcDate(path.transplant_date),
    real_planting_date:   calcDate(path.planting_date),
    real_harvest_date:    calcDate(path.harvest_date),
  };
}

function closeModal(): void {
  const modal = document.getElementById('instance-modal')!;
  modal.classList.add('hidden');
  modal.innerHTML = '';
}

/**
 * Initialise the interactive cell-selection canvas inside the instance modal.
 * The caller passes a mutable `selectedCells` Set; this function modifies it
 * in place as the user clicks/drags cells, and triggers a redraw + count update.
 */
function initCellSelector(
  layout: GridLayout,
  selectedCells: Set<number>,
  canvas: HTMLCanvasElement,
): void {
  // Adaptive cell size: fill the available width inside the modal content area.
  // The modal uses max-width:720px with 2×2rem (64px) padding, leaving ≈654px;
  // subtract a small scrollbar allowance to get MODAL_CONTENT_WIDTH.
  const MIN_CELL_SIZE      = 14;
  const MAX_CELL_SIZE      = 22;
  const MODAL_CONTENT_WIDTH = 618;
  const CELL = Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, Math.floor(MODAL_CONTENT_WIDTH / layout.cols)));
  canvas.width  = layout.cols * CELL;
  canvas.height = layout.rows * CELL;
  canvas.style.cursor = 'crosshair';

  // Build lookup map keyed by "col,row"
  const cellByPos = new Map<string, GridCell>();
  (layout.cells ?? []).forEach((c) => {
    cellByPos.set(`${c.col},${c.row}`, c);
  });

  drawCellSelector(canvas, layout, cellByPos, selectedCells, CELL);

  let isDragging = false;
  let dragMode: 'select' | 'deselect' = 'select';

  const getCellAt = (e: MouseEvent): GridCell | null => {
    const rect = canvas.getBoundingClientRect();
    const col = Math.floor((e.clientX - rect.left) / CELL);
    const row = Math.floor((e.clientY - rect.top)  / CELL);
    return cellByPos.get(`${col},${row}`) ?? null;
  };

  const applyDrag = (cell: GridCell): void => {
    const alreadySelected = selectedCells.has(cell.id);
    if (dragMode === 'select' && !alreadySelected) {
      selectedCells.add(cell.id);
    } else if (dragMode === 'deselect' && alreadySelected) {
      selectedCells.delete(cell.id);
    } else {
      return; // no change needed – skip redraw
    }
    drawCellSelector(canvas, layout, cellByPos, selectedCells, CELL);
    const countEl = document.getElementById('cell-selection-count');
    if (countEl) countEl.textContent = `${selectedCells.size} cellule(s) sélectionnée(s)`;
  };

  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    const cell = getCellAt(e);
    if (cell) {
      dragMode = selectedCells.has(cell.id) ? 'deselect' : 'select';
      applyDrag(cell);
    }
  });
  canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const cell = getCellAt(e);
    if (cell) applyDrag(cell);
  });
  canvas.addEventListener('mouseup',    () => { isDragging = false; });
  canvas.addEventListener('mouseleave', () => { isDragging = false; });
}

/**
 * Redraw the cell-selection canvas.
 * Selected cells are highlighted with an amber overlay and bold border.
 */
function drawCellSelector(
  canvas: HTMLCanvasElement,
  layout: GridLayout,
  cellByPos: Map<string, GridCell>,
  selectedCells: Set<number>,
  cellSize: number,
): void {
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.cols; col++) {
      const cell       = cellByPos.get(`${col},${row}`);
      const isSelected = cell ? selectedCells.has(cell.id) : false;
      const baseColor  = cell ? (CELL_TYPE_COLORS[cell.type] ?? '#f5f5f5') : '#f0f0f0';

      ctx.fillStyle = baseColor;
      ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);

      if (isSelected) {
        ctx.fillStyle = 'rgba(255,193,7,0.55)';
        ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        ctx.strokeStyle = '#e65100';
        ctx.lineWidth   = 2;
        ctx.strokeRect(col * cellSize + 1, row * cellSize + 1, cellSize - 2, cellSize - 2);
      } else {
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth   = 1;
        ctx.strokeRect(col * cellSize, row * cellSize, cellSize, cellSize);
      }
    }
  }
}

async function deleteInstance(id: number): Promise<void> {
  if (!confirm('Supprimer cette culture ?')) return;
  try {
    await cropInstancesApi.delete(id);
    state.instances = state.instances.filter((i) => i.id !== id);
    renderInstances();
    await renderTrackingGrid();
  } catch (err: any) {
    alert('Erreur : ' + err.message);
  }
}

function bindTrackingEvents(container: HTMLElement): void {
  container.querySelector('#btn-add-instance')?.addEventListener('click', openAddInstanceModal);
  container.querySelector('#view-date')?.addEventListener('change', async (e) => {
    state.viewDate = (e.target as HTMLInputElement).value;
    await renderTrackingGrid();
  });
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
