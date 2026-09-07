async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  shop: () => request("/api/shop"),
  updateShop: (body) => request("/api/shop", { method: "PATCH", body }),
  unlock: (password) => request("/api/admin/unlock", { method: "POST", body: { password } }),
  changePassword: (body) => request("/api/admin/password", { method: "POST", body }),
  uploadLogo: (body) => request("/api/admin/logo", { method: "POST", body }),
  format: (password) => request("/api/admin/format", { method: "POST", body: { password } }),
  meta: () => request("/api/meta"),
  materials: (params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v))
    );
    const suffix = query.toString() ? `?${query}` : "";
    return request(`/api/materials${suffix}`);
  },
  material: (id) => request(`/api/materials/${id}`),
  addMaterials: (body) => request("/api/materials", { method: "POST", body }),
  cutMaterial: (id, body) => request(`/api/materials/${id}/cut`, { method: "POST", body }),
  removeMaterial: (id) => request(`/api/materials/${id}/remove`, { method: "POST", body: {} }),
  parts: (params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v))
    );
    const suffix = query.toString() ? `?${query}` : "";
    return request(`/api/parts${suffix}`);
  },
  addPart: (body) => request("/api/parts", { method: "POST", body }),
  updatePart: (id, body) => request(`/api/parts/${id}`, { method: "PATCH", body }),
  receivePart: (id, body) => request(`/api/parts/${id}/receive`, { method: "POST", body }),
  issuePart: (id, body) => request(`/api/parts/${id}/issue`, { method: "POST", body }),
  history: () => request("/api/history"),
  costs: () => request("/api/costs"),
  pulse: () => request("/api/pulse"),
};
