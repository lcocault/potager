// ============================================================
// Grid editor module – Interactive 2D garden planner
// ============================================================
import { gridApi, GridLayout, GridCell, CellType, CELL_TYPE_COLORS } from './api.js';

const CELL_TYPES: { type: CellType; label: string }[] = [
  { type: 'vide',          label: 'Vide'            },
  { type: 'carre_potager', label: 'Carré potager'   },
  { type: 'pleine_terre',  label: 'Pleine terre'    },
  { type: 'allee',         label: 'Allée'            },
  { type: 'bati',          label: 'Bâti'             },
  { type: 'non_cultivable',label: 'Non cultivable'  },
  { type: 'vegetation',    label: 'Végétation'       },
];

type CellMap = Map<string, Partial<GridCell>>;

interface GridState {
  layout: GridLayout | null;
  cells: CellMap;          // key = "col,row"
  selectedType: CellType;
  isDragging: boolean;
  isDirty: boolean;
}

const state: GridState = {
  layout:       null,
  cells:        new Map(),
  selectedType: 'carre_potager',
  isDragging:   false,
  isDirty:      false,
};

export async function initGrid(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <div class="module-header">
      <h2>🗺️ Plan du terrain</h2>
      <div class="toolbar">
        <select id="layout-select"><option value="">Chargement…</option></select>
        <button id="btn-new-layout" class="btn btn-secondary">+ Nouveau plan</button>
        <button id="btn-save-grid" class="btn btn-primary">💾 Enregistrer</button>
        <button id="btn-clear-grid" class="btn btn-danger">🗑️ Réinitialiser</button>
        <button id="btn-delete-layout" class="btn btn-danger">🗑️ Supprimer le plan</button>
      </div>
    </div>
    <div class="grid-workspace">
      <div class="grid-legend" id="grid-legend"></div>
      <div id="grid-canvas-wrapper" class="grid-canvas-wrapper">
        <canvas id="grid-canvas"></canvas>
      </div>
    </div>
    <div id="grid-status" class="grid-status"></div>
  `;

  renderLegend();
  bindGridEvents(container);
  await loadLayouts();
}

function renderLegend(): void {
  const legend = document.getElementById('grid-legend')!;
  legend.innerHTML = CELL_TYPES.map((ct) => {
    const color = CELL_TYPE_COLORS[ct.type] ?? '#f5f5f5';
    return `
      <div class="legend-item ${state.selectedType === ct.type ? 'active' : ''}"
           data-type="${ct.type}"
           style="--cell-color:${color}">
        <span class="legend-swatch" style="background:${color}"></span>
        ${ct.label}
      </div>
    `;
  }).join('');
  legend.querySelectorAll<HTMLDivElement>('.legend-item').forEach((el) => {
    el.addEventListener('click', () => {
      state.selectedType = el.dataset.type as CellType;
      document.querySelectorAll('.legend-item').forEach((e) => e.classList.remove('active'));
      el.classList.add('active');
    });
  });
}

async function loadLayouts(): Promise<void> {
  const layouts = await gridApi.list();
  const sel     = document.getElementById('layout-select') as HTMLSelectElement;
  sel.innerHTML = layouts.length > 0
    ? layouts.map((l) => `<option value="${l.id}">${escHtml(l.name)}</option>`).join('')
    : '<option value="">Aucun plan</option>';
  if (layouts.length > 0) {
    await loadLayout(layouts[0].id);
  } else {
    state.layout  = null;
    state.cells   = new Map();
    const canvas  = document.getElementById('grid-canvas') as HTMLCanvasElement | null;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    setLayoutActionsEnabled(false);
  }
}

function setLayoutActionsEnabled(enabled: boolean): void {
  const ids = ['btn-save-grid', 'btn-clear-grid', 'btn-delete-layout'];
  ids.forEach((id) => {
    const btn = document.getElementById(id) as HTMLButtonElement | null;
    if (btn) btn.disabled = !enabled;
  });
}

async function loadLayout(id: number): Promise<void> {
  const layout   = await gridApi.get(id);
  state.layout   = layout;
  state.cells    = new Map();
  state.isDirty  = false;

  (layout.cells ?? []).forEach((c) => {
    state.cells.set(`${c.col},${c.row}`, c);
  });

  setLayoutActionsEnabled(true);
  renderGrid();
  setStatus(`Plan chargé : ${layout.name} (${layout.cols}×${layout.rows})`);
}

function renderGrid(): void {
  const wrapper = document.getElementById('grid-canvas-wrapper')!;
  const canvas  = document.getElementById('grid-canvas') as HTMLCanvasElement;
  const layout  = state.layout!;

  const CELL = 28; // px per cell
  canvas.width  = layout.cols * CELL;
  canvas.height = layout.rows * CELL;
  canvas.style.cursor = 'crosshair';

  drawGrid();

  // Re-bind mouse events (replace old ones by replacing canvas)
  const newCanvas = canvas.cloneNode(false) as HTMLCanvasElement;
  newCanvas.id     = 'grid-canvas';
  newCanvas.width  = canvas.width;
  newCanvas.height = canvas.height;
  newCanvas.style.cursor = 'crosshair';
  wrapper.replaceChild(newCanvas, canvas);

  bindCanvasEvents(newCanvas, CELL);
  drawGrid(newCanvas);
}

function drawGrid(canvas?: HTMLCanvasElement): void {
  const c      = canvas ?? (document.getElementById('grid-canvas') as HTMLCanvasElement);
  const ctx    = c.getContext('2d')!;
  const layout = state.layout!;
  const CELL   = Math.floor(c.width / layout.cols);

  ctx.clearRect(0, 0, c.width, c.height);

  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.cols; col++) {
      const cell  = state.cells.get(`${col},${row}`);
      const color = cell ? getCellColor(cell.type as CellType) : getCellColor('vide');
      ctx.fillStyle = color;
      ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.strokeRect(col * CELL, row * CELL, CELL, CELL);
    }
  }
}

function getCellColor(type: CellType): string {
  return CELL_TYPE_COLORS[type] ?? '#f5f5f5';
}

function getCanvasCell(canvas: HTMLCanvasElement, e: MouseEvent, cellSize: number): { col: number; row: number } {
  const rect = canvas.getBoundingClientRect();
  const x    = e.clientX - rect.left;
  const y    = e.clientY - rect.top;
  return {
    col: Math.floor(x / cellSize),
    row: Math.floor(y / cellSize),
  };
}

function paintCell(col: number, row: number): void {
  const layout = state.layout!;
  if (col < 0 || col >= layout.cols || row < 0 || row >= layout.rows) return;
  state.cells.set(`${col},${row}`, { col, row, type: state.selectedType, layout_id: layout.id });
  state.isDirty = true;
  drawGrid();
}

function bindCanvasEvents(canvas: HTMLCanvasElement, cellSize: number): void {
  canvas.addEventListener('mousedown', (e) => {
    state.isDragging = true;
    const { col, row } = getCanvasCell(canvas, e, cellSize);
    paintCell(col, row);
  });
  canvas.addEventListener('mousemove', (e) => {
    if (!state.isDragging) return;
    const { col, row } = getCanvasCell(canvas, e, cellSize);
    paintCell(col, row);
  });
  canvas.addEventListener('mouseup',   () => { state.isDragging = false; });
  canvas.addEventListener('mouseleave', () => { state.isDragging = false; });
}

async function saveGrid(): Promise<void> {
  if (!state.layout) return;
  const cells = Array.from(state.cells.values()).map((c) => ({
    col:   c.col!,
    row:   c.row!,
    type:  c.type ?? 'vide',
    label: c.label ?? null,
    color: null,
  }));
  try {
    await gridApi.save(state.layout.id, { cells });
    state.isDirty = false;
    setStatus('Plan enregistré ✓');
  } catch (err: any) {
    alert('Erreur sauvegarde : ' + err.message);
  }
}

async function clearGrid(): Promise<void> {
  if (!state.layout) return;
  if (!confirm('Réinitialiser toutes les cases ?')) return;
  await gridApi.clearCells(state.layout.id);
  state.cells.clear();
  state.isDirty = false;
  drawGrid();
  setStatus('Plan réinitialisé');
}

async function createNewLayout(): Promise<void> {
  const name = prompt('Nom du plan :');
  if (!name) return;
  const cols = parseInt(prompt('Nombre de colonnes (défaut 20) :') ?? '20', 10) || 20;
  const rows = parseInt(prompt('Nombre de lignes (défaut 15) :')   ?? '15', 10) || 15;
  try {
    const layout = await gridApi.create({ name, cols, rows, cell_size: 30 });
    state.layout = layout;
    state.cells.clear();
    await loadLayouts();
    const sel = document.getElementById('layout-select') as HTMLSelectElement;
    sel.value = String(layout.id);
    renderGrid();
    setStatus(`Nouveau plan créé : ${name}`);
  } catch (err: any) {
    alert('Erreur : ' + err.message);
  }
}

async function deleteLayout(): Promise<void> {
  if (!state.layout) return;
  if (!confirm(`Supprimer le plan « ${state.layout.name} » ? Cette action est irréversible.`)) return;
  try {
    await gridApi.delete(state.layout.id);
    state.layout = null;
    state.cells.clear();
    state.isDirty = false;
    await loadLayouts();
    setStatus('Plan supprimé.');
  } catch (err: any) {
    alert('Erreur : ' + err.message);
  }
}

function bindGridEvents(container: HTMLElement): void {
  container.querySelector('#btn-save-grid')?.addEventListener('click', saveGrid);
  container.querySelector('#btn-clear-grid')?.addEventListener('click', clearGrid);
  container.querySelector('#btn-new-layout')?.addEventListener('click', createNewLayout);
  container.querySelector('#btn-delete-layout')?.addEventListener('click', deleteLayout);
  container.querySelector('#layout-select')?.addEventListener('change', async (e) => {
    if (state.isDirty && !confirm('Quitter sans enregistrer ?')) return;
    const id = Number((e.target as HTMLSelectElement).value);
    if (id) await loadLayout(id);
  });
}

function setStatus(msg: string): void {
  const el = document.getElementById('grid-status');
  if (el) el.textContent = msg;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
