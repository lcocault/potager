// ============================================================
// API Client - Central HTTP communication layer
// ============================================================

export const API_BASE = (window as any).API_BASE ?? '/api';

export interface Species {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
}

export type SowingCondition =
  | 'pleine_terre'
  | 'godet_serre_froide'
  | 'godet_serre_chauffee'
  | 'sous_chassis'
  | 'interieur';

export interface CropPath {
  id: number;
  species_id: number;
  species_name: string;
  species_icon: string | null;
  name: string;
  sowing_date: string | null;
  sowing_condition: SowingCondition;
  transplant_date: string | null;
  planting_date: string | null;
  harvest_date: string | null;
  notes: string | null;
}

export type CropStatus = 'planifie' | 'en_cours' | 'termine' | 'abandonne';

export interface CropInstance {
  id: number;
  crop_path_id: number;
  path_name: string;
  species_name: string;
  species_icon: string | null;
  status: CropStatus;
  /** Actual start date used to calculate real dates from the itinerary */
  start_date: string | null;
  real_sowing_date: string | null;
  real_transplant_date: string | null;
  real_planting_date: string | null;
  real_harvest_date: string | null;
  /** Theoretical dates from the linked crop path (MM-DD format) */
  sowing_date: string | null;
  transplant_date: string | null;
  planting_date: string | null;
  harvest_date: string | null;
  notes: string | null;
  cells?: GridCell[];
}

export type CellType =
  | 'bati'
  | 'non_cultivable'
  | 'vegetation'
  | 'carre_potager'
  | 'pleine_terre'
  | 'allee'
  | 'vide';

/** Canonical fill colours for each grid cell type, shared across modules. */
export const CELL_TYPE_COLORS: Record<CellType, string> = {
  vide:           '#f5f5f5',
  carre_potager:  '#4caf50',
  pleine_terre:   '#8d6e63',
  allee:          '#bdbdbd',
  bati:           '#607d8b',
  non_cultivable: '#9e9e9e',
  vegetation:     '#2e7d32',
};

export interface GridCell {
  id: number;
  layout_id: number;
  col: number;
  row: number;
  type: CellType;
  label: string | null;
  color: string | null;
}

export interface GridLayout {
  id: number;
  name: string;
  cols: number;
  rows: number;
  cell_size: number;
  cells?: GridCell[];
}

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return data as T;
}

// ── Species ───────────────────────────────────────────────
export const speciesApi = {
  list: ()                        => request<Species[]>(`${API_BASE}/species`),
  get:  (id: number)              => request<Species>(`${API_BASE}/species/${id}`),
  create: (data: Partial<Species>) =>
    request<Species>(`${API_BASE}/species`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Species>) =>
    request<Species>(`${API_BASE}/species/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<{ success: boolean }>(`${API_BASE}/species/${id}`, { method: 'DELETE' }),
};

// ── Crop Paths ────────────────────────────────────────────
export const cropPathsApi = {
  list: (speciesId?: number) =>
    request<CropPath[]>(`${API_BASE}/crop-paths${speciesId ? `?species_id=${speciesId}` : ''}`),
  get: (id: number) => request<CropPath>(`${API_BASE}/crop-paths/${id}`),
  create: (data: Partial<CropPath>) =>
    request<CropPath>(`${API_BASE}/crop-paths`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<CropPath>) =>
    request<CropPath>(`${API_BASE}/crop-paths/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<{ success: boolean }>(`${API_BASE}/crop-paths/${id}`, { method: 'DELETE' }),
  import: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return fetch(`${API_BASE}/crop-paths/import`, { method: 'POST', body: fd }).then(async (r) => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      return d as { imported: number; errors: string[]; paths: CropPath[] };
    });
  },
};

// ── Crop Instances ────────────────────────────────────────
export const cropInstancesApi = {
  list: (params?: { status?: string; date?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>);
    return request<CropInstance[]>(`${API_BASE}/crop-instances${q.toString() ? `?${q}` : ''}`);
  },
  get: (id: number) => request<CropInstance>(`${API_BASE}/crop-instances/${id}`),
  create: (data: Partial<CropInstance> & { cell_ids?: number[] }) =>
    request<CropInstance>(`${API_BASE}/crop-instances`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<CropInstance> & { cell_ids?: number[] }) =>
    request<CropInstance>(`${API_BASE}/crop-instances/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<{ success: boolean }>(`${API_BASE}/crop-instances/${id}`, { method: 'DELETE' }),
};

// ── Grid ──────────────────────────────────────────────────
export const gridApi = {
  list: () => request<GridLayout[]>(`${API_BASE}/grid`),
  get:  (id: number) => request<GridLayout>(`${API_BASE}/grid/${id}`),
  create: (data: Partial<GridLayout>) =>
    request<GridLayout>(`${API_BASE}/grid`, { method: 'POST', body: JSON.stringify(data) }),
  save: (id: number, data: Partial<Omit<GridLayout, 'cells'>> & { cells?: Partial<GridCell>[] }) =>
    request<GridLayout>(`${API_BASE}/grid/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<{ success: boolean }>(`${API_BASE}/grid/${id}`, { method: 'DELETE' }),
  clearCells: (id: number) =>
    request<{ success: boolean }>(`${API_BASE}/grid/${id}/cells`, { method: 'DELETE' }),
  getCrops: (id: number, date: string) =>
    request<GridCell[]>(`${API_BASE}/grid/${id}/crops?date=${date}`),
};
