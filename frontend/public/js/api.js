// ============================================================
// API Client - Central HTTP communication layer
// ============================================================
export const API_BASE = window.API_BASE ?? '/api';
async function request(url, options = {}) {
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
    }
    return data;
}
// ── Species ───────────────────────────────────────────────
export const speciesApi = {
    list: () => request(`${API_BASE}/species`),
    get: (id) => request(`${API_BASE}/species/${id}`),
    create: (data) => request(`${API_BASE}/species`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`${API_BASE}/species/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`${API_BASE}/species/${id}`, { method: 'DELETE' }),
};
// ── Crop Paths ────────────────────────────────────────────
export const cropPathsApi = {
    list: (speciesId) => request(`${API_BASE}/crop-paths${speciesId ? `?species_id=${speciesId}` : ''}`),
    get: (id) => request(`${API_BASE}/crop-paths/${id}`),
    create: (data) => request(`${API_BASE}/crop-paths`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`${API_BASE}/crop-paths/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`${API_BASE}/crop-paths/${id}`, { method: 'DELETE' }),
    import: (file) => {
        const fd = new FormData();
        fd.append('file', file);
        return fetch(`${API_BASE}/crop-paths/import`, { method: 'POST', body: fd }).then(async (r) => {
            const d = await r.json();
            if (!r.ok)
                throw new Error(d.error ?? `HTTP ${r.status}`);
            return d;
        });
    },
};
// ── Crop Instances ────────────────────────────────────────
export const cropInstancesApi = {
    list: (params) => {
        const q = new URLSearchParams(params);
        return request(`${API_BASE}/crop-instances${q.toString() ? `?${q}` : ''}`);
    },
    get: (id) => request(`${API_BASE}/crop-instances/${id}`),
    create: (data) => request(`${API_BASE}/crop-instances`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`${API_BASE}/crop-instances/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`${API_BASE}/crop-instances/${id}`, { method: 'DELETE' }),
};
// ── Grid ──────────────────────────────────────────────────
export const gridApi = {
    list: () => request(`${API_BASE}/grid`),
    get: (id) => request(`${API_BASE}/grid/${id}`),
    create: (data) => request(`${API_BASE}/grid`, { method: 'POST', body: JSON.stringify(data) }),
    save: (id, data) => request(`${API_BASE}/grid/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`${API_BASE}/grid/${id}`, { method: 'DELETE' }),
    clearCells: (id) => request(`${API_BASE}/grid/${id}/cells`, { method: 'DELETE' }),
    getCrops: (id, date) => request(`${API_BASE}/grid/${id}/crops?date=${date}`),
};
//# sourceMappingURL=api.js.map