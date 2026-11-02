/** Shared HTTP client. Defaults preserve the existing production REST contracts. */
export const API_CONFIG = {
  SERVER_URL: 'https://lostnet-api.tail0e8b19.ts.net',
  API_BASE_URL: 'https://lostnet-api.tail0e8b19.ts.net/api',
  TIMEOUT_MS: 5000,
  ENDPOINTS: {
    REPORTES: '/reportes',
    REPORTAR: '/reportar',
    PUNTOS_SEGUROS: '/puntos-seguros',
    ALERTAS: '/mis-alertas',
    CONFIG: '/config',
    CONTACTO: '/contacto',
    COMENTARIOS_GET: '/comentarios',
    COMENTAR_POST: '/comentar'
  }
};

export class ApiService {
  constructor({ baseUrl = API_CONFIG.API_BASE_URL, serverUrl = API_CONFIG.SERVER_URL, timeoutMs = API_CONFIG.TIMEOUT_MS } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.serverUrl = serverUrl;
    this.timeoutMs = timeoutMs;
  }

  async get(endpoint, params = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    const url = new URL(`${this.baseUrl}${endpoint}`);
    url.searchParams.append('_t', Date.now());
    Object.entries(params).forEach(([k, v]) => {
      if (v != null) url.searchParams.append(k, v);
    });
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`API Error: ${res.status}`);
      return await res.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async post(endpoint, body, isJson = false) {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.timeoutMs * 12
    );
    const url = new URL(`${this.baseUrl}${endpoint}`);

    const options = { method: 'POST', body, signal: controller.signal };
    if (isJson) {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(body);
    }

    try {
      const res = await fetch(url, options);
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`API Error: ${res.status}`);
      return await res.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async delete(endpoint, params = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    const url = new URL(`${this.baseUrl}${endpoint}`);
    Object.entries(params).forEach(([k, v]) => {
      if (v != null) url.searchParams.append(k, v);
    });
    const options = { method: 'DELETE', signal: controller.signal };
    try {
      const res = await fetch(url, options);
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`API Error: ${res.status}`);
      return await res.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  fetchData(currentUser) {
    const promises = [
      this.get(API_CONFIG.ENDPOINTS.REPORTES),
      this.get(API_CONFIG.ENDPOINTS.PUNTOS_SEGUROS),
      this.get(API_CONFIG.ENDPOINTS.CONFIG).catch(() => null)
    ];
    if (currentUser?.email) {
      promises.push(
        this.get(API_CONFIG.ENDPOINTS.ALERTAS, { email: currentUser.email }).catch(
          () => []
        )
      );
    }
    return Promise.allSettled(promises);
  }

  resolveUrl(path) {
    // Uploaded photos resolve against the server origin, not the /api prefix.
    return path && !path.startsWith('http') ? `${this.serverUrl}${path}` : path;
  }

  fetchContacto(ownerId) {
    return this.get(API_CONFIG.ENDPOINTS.CONTACTO, { user_id: ownerId });
  }
}

/** Assemble the existing multipart contract; never set its Content-Type manually. */
export function createReportFormData({ user, fields: rawForm, photo, now = Date.now() }) {
  const manualData = new FormData();
  manualData.append('user_id', user.sub || 'anon');
  manualData.append('email', user.email || '');
  manualData.append('description', rawForm.get('description'));
  manualData.append('category', rawForm.get('category'));
  manualData.append('phone', rawForm.get('phone'));
  manualData.append('security_question', rawForm.get('security_question'));
  manualData.append('security_answer', rawForm.get('security_answer'));
  manualData.append('latitude', rawForm.get('lat'));
  manualData.append('longitude', rawForm.get('lon'));
  manualData.append('status', rawForm.get('status') || 'LOST');
  manualData.append('timestamp', Math.floor(now / 1000).toString());
  if (photo) manualData.append('foto', photo);
  return manualData;
}
