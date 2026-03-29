// ============================================================
// Calendar module – Timeline visualization of crop paths
// ============================================================
import { cropPathsApi, speciesApi, CropPath, Species, SowingCondition } from './api.js';

const MONTHS = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
  'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc',
];

const CONDITION_LABELS: Record<SowingCondition, string> = {
  pleine_terre:        'Pleine terre',
  godet_serre_froide:  'Godet serre froide',
  godet_serre_chauffee:'Godet serre chauffée',
  sous_chassis:        'Sous chassis',
  interieur:           'Intérieur',
};

let allPaths: CropPath[] = [];
let allSpecies: Species[] = [];

export async function initCalendar(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <div class="module-header">
      <h2>📅 Calendrier des itinéraires</h2>
      <div class="toolbar">
        <select id="species-filter"><option value="">Toutes les espèces</option></select>
        <button id="btn-add-path" class="btn btn-primary">+ Ajouter</button>
        <button id="btn-import-excel" class="btn btn-secondary">📥 Importer Excel</button>
        <input type="file" id="excel-file-input" accept=".xlsx,.xls,.ods" style="display:none">
      </div>
    </div>
    <div id="timeline-container" class="timeline-container"></div>
    <div id="path-modal" class="modal hidden"></div>
  `;

  [allPaths, allSpecies] = await Promise.all([
    cropPathsApi.list(),
    speciesApi.list(),
  ]);

  populateSpeciesFilter();
  renderTimeline();
  bindCalendarEvents(container);
}

function populateSpeciesFilter(): void {
  const sel = document.getElementById('species-filter') as HTMLSelectElement;
  allSpecies.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = String(s.id);
    opt.textContent = `${s.icon ?? '🌱'} ${s.name}`;
    sel.appendChild(opt);
  });
}

function renderTimeline(filteredSpeciesId?: number): void {
  const container = document.getElementById('timeline-container')!;
  const paths = filteredSpeciesId
    ? allPaths.filter((p) => p.species_id === filteredSpeciesId)
    : allPaths;

  if (paths.length === 0) {
    container.innerHTML = '<p class="empty-state">Aucun itinéraire. Cliquez sur "+ Ajouter" pour commencer.</p>';
    return;
  }

  // Build month header (12 months)
  let html = `
    <div class="timeline">
      <div class="timeline-header">
        <div class="timeline-label-col">Itinéraire</div>
        <div class="timeline-months">
          ${MONTHS.map((m) => `<div class="month-cell">${m}</div>`).join('')}
        </div>
      </div>
  `;

  paths.forEach((p) => {
    const bars = buildBars(p);
    html += `
      <div class="timeline-row" data-id="${p.id}">
        <div class="timeline-label-col">
          <span class="species-icon">${p.species_icon ?? '🌱'}</span>
          <span class="path-name">${escHtml(p.name)}</span>
          <span class="species-name">${escHtml(p.species_name)}</span>
          <div class="row-actions">
            <button class="btn-icon btn-edit" data-id="${p.id}" title="Modifier">✏️</button>
            <button class="btn-icon btn-delete" data-id="${p.id}" title="Supprimer">🗑️</button>
          </div>
        </div>
        <div class="timeline-months">
          <div class="bars-container">${bars}</div>
        </div>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;

  // Bind row actions
  container.querySelectorAll<HTMLButtonElement>('.btn-edit').forEach((btn) => {
    btn.addEventListener('click', () => openEditModal(Number(btn.dataset.id)));
  });
  container.querySelectorAll<HTMLButtonElement>('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', () => deletePath(Number(btn.dataset.id)));
  });
}

/** Returns the 0-to-100 horizontal position of a date within its calendar year */
function dateToYearPos(d: Date): number {
  const isLeap    = (d.getFullYear() % 4 === 0 && d.getFullYear() % 100 !== 0) || d.getFullYear() % 400 === 0;
  const daysInYear = isLeap ? 366 : 365;
  const start     = new Date(d.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((d.getTime() - start.getTime()) / 86_400_000);
  return (dayOfYear / daysInYear) * 100;
}

function buildBars(p: CropPath): string {
  const bars: string[] = [];

  const addBar = (dateStr: string | null, label: string, cssClass: string) => {
    if (!dateStr) return;
    const d   = new Date(dateStr);
    const pos = dateToYearPos(d);
    bars.push(
      `<div class="timeline-bar ${cssClass}" style="left:${pos.toFixed(2)}%" title="${label}: ${dateStr}">
         <span class="bar-label">${label}</span>
       </div>`
    );
  };

  // Draw a range bar if sowing→harvest
  if (p.sowing_date && p.harvest_date) {
    const s   = new Date(p.sowing_date);
    const e   = new Date(p.harvest_date);
    const pos = dateToYearPos(s);
    const end = dateToYearPos(e);
    const w   = end - pos;
    bars.push(
      `<div class="timeline-range" style="left:${pos.toFixed(2)}%;width:${w.toFixed(2)}%"
            title="${p.name}">
       </div>`
    );
  }

  addBar(p.sowing_date,     'Semis',      'bar-sowing');
  addBar(p.transplant_date, 'Repiquage',  'bar-transplant');
  addBar(p.planting_date,   'Plantation', 'bar-planting');
  addBar(p.harvest_date,    'Récolte',    'bar-harvest');

  return bars.join('');
}

function openAddModal(): void {
  openModal(null);
}

async function openEditModal(id: number): Promise<void> {
  const path = await cropPathsApi.get(id);
  openModal(path);
}

function openModal(path: CropPath | null): void {
  const modal = document.getElementById('path-modal')!;
  modal.classList.remove('hidden');

  const speciesOptions = allSpecies
    .map((s) => `<option value="${s.id}" ${path?.species_id === s.id ? 'selected' : ''}>${s.icon ?? '🌱'} ${escHtml(s.name)}</option>`)
    .join('');

  const conditionOptions = (Object.entries(CONDITION_LABELS) as [SowingCondition, string][])
    .map(([v, l]) => `<option value="${v}" ${path?.sowing_condition === v ? 'selected' : ''}>${l}</option>`)
    .join('');

  modal.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-box">
        <h3>${path ? 'Modifier' : 'Ajouter'} un itinéraire</h3>
        <form id="path-form">
          <label>Espèce *
            <select name="species_id" required>${speciesOptions}</select>
          </label>
          <label>Nom *
            <input name="name" type="text" value="${escHtml(path?.name ?? '')}" required>
          </label>
          <label>Date de semis
            <input name="sowing_date" type="date" value="${path?.sowing_date ?? ''}">
          </label>
          <label>Condition de semis
            <select name="sowing_condition">${conditionOptions}</select>
          </label>
          <label>Date de repiquage
            <input name="transplant_date" type="date" value="${path?.transplant_date ?? ''}">
          </label>
          <label>Date de mise en terre
            <input name="planting_date" type="date" value="${path?.planting_date ?? ''}">
          </label>
          <label>Date de récolte
            <input name="harvest_date" type="date" value="${path?.harvest_date ?? ''}">
          </label>
          <label>Notes
            <textarea name="notes">${escHtml(path?.notes ?? '')}</textarea>
          </label>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">${path ? 'Enregistrer' : 'Créer'}</button>
            <button type="button" id="btn-modal-cancel" class="btn btn-secondary">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('btn-modal-cancel')!.addEventListener('click', closeModal);

  const form = document.getElementById('path-form') as HTMLFormElement;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd   = new FormData(form);
    const data: Record<string, string | null> = {};
    fd.forEach((v, k) => { data[k] = v.toString() || null; });

    try {
      if (path) {
        const updated = await cropPathsApi.update(path.id, data as any);
        allPaths = allPaths.map((p) => (p.id === updated.id ? updated : p));
      } else {
        const created = await cropPathsApi.create(data as any);
        allPaths.push(created);
      }
      const filter = (document.getElementById('species-filter') as HTMLSelectElement).value;
      renderTimeline(filter ? Number(filter) : undefined);
      closeModal();
    } catch (err: any) {
      alert('Erreur : ' + err.message);
    }
  });
}

function closeModal(): void {
  const modal = document.getElementById('path-modal')!;
  modal.classList.add('hidden');
  modal.innerHTML = '';
}

async function deletePath(id: number): Promise<void> {
  if (!confirm('Supprimer cet itinéraire ?')) return;
  try {
    await cropPathsApi.delete(id);
    allPaths = allPaths.filter((p) => p.id !== id);
    const filter = (document.getElementById('species-filter') as HTMLSelectElement).value;
    renderTimeline(filter ? Number(filter) : undefined);
  } catch (err: any) {
    alert('Erreur : ' + err.message);
  }
}

function bindCalendarEvents(container: HTMLElement): void {
  container.querySelector('#btn-add-path')?.addEventListener('click', openAddModal);

  container.querySelector<HTMLInputElement>('#excel-file-input')?.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const result = await cropPathsApi.import(file);
      if (result.errors.length > 0) {
        alert(`Import terminé : ${result.imported} importés.\nErreurs :\n${result.errors.join('\n')}`);
      } else {
        alert(`Import réussi : ${result.imported} itinéraire(s) créé(s).`);
      }
      allPaths = await cropPathsApi.list();
      renderTimeline();
    } catch (err: any) {
      alert('Erreur import : ' + err.message);
    }
  });

  container.querySelector('#btn-import-excel')?.addEventListener('click', () => {
    (document.getElementById('excel-file-input') as HTMLInputElement).click();
  });

  container.querySelector('#species-filter')?.addEventListener('change', (e) => {
    const val = (e.target as HTMLSelectElement).value;
    renderTimeline(val ? Number(val) : undefined);
  });
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
