// ============================================================
// Main application entry point
// ============================================================
import { initCalendar } from './calendar.js';
import { initGrid }     from './grid.js';
import { initTracking } from './tracking.js';

type Module = 'calendar' | 'grid' | 'tracking';

const NAV_ITEMS: { id: Module; label: string }[] = [
  { id: 'calendar', label: '📅 Calendrier' },
  { id: 'grid',     label: '🗺️ Plan du terrain' },
  { id: 'tracking', label: '🌿 Suivi cultures' },
];

let currentModule: Module | null = null;

async function loadModule(mod: Module): Promise<void> {
  if (currentModule === mod) return;
  currentModule = mod;

  // Update nav
  document.querySelectorAll<HTMLElement>('.nav-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.module === mod);
  });

  const main = document.getElementById('main-content')!;
  main.innerHTML = '<div class="loading">Chargement…</div>';

  try {
    switch (mod) {
      case 'calendar': await initCalendar(main); break;
      case 'grid':     await initGrid(main);     break;
      case 'tracking': await initTracking(main); break;
    }
  } catch (err: any) {
    main.innerHTML = `<div class="error-state">
      <h3>Erreur de chargement</h3>
      <p>${err.message}</p>
      <button onclick="location.reload()" class="btn btn-secondary">Réessayer</button>
    </div>`;
  }
}

function buildNav(): void {
  const nav = document.getElementById('main-nav')!;
  nav.innerHTML = NAV_ITEMS.map((item) => `
    <button class="nav-item" data-module="${item.id}">${item.label}</button>
  `).join('');
  nav.querySelectorAll<HTMLButtonElement>('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => loadModule(btn.dataset.module as Module));
  });
}

document.addEventListener('DOMContentLoaded', () => {
  buildNav();
  loadModule('calendar');
});
