import { beforeAll, afterAll, afterEach, describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw/http';
import { setTimeout as delay } from 'node:timers/promises';
import { setupServer } from 'msw/node';
import { ApiService, API_CONFIG, createReportFormData } from '../../src/scripts/api.js';

// Reserved .test domain: tests never contact production. Every unmatched request is an error.
const base = 'https://lostnet.test/api';
const api = new ApiService({ baseUrl: base + '/', serverUrl: 'https://lostnet.test' });
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function intercept(method, endpoint, inspect, response) {
  server.use(http[method](base + endpoint, async ({ request, params }) => {
    await inspect(request, params);
    return HttpResponse.json(response);
  }));
}

describe('HTTP requests and existing REST contracts (MSW)', () => {
  it('gets reports with a cache-busting query and returns complete JSON', async () => {
    const data = [{ id: 17, desc_short: 'Llaves', status: 'FOUND', lat: 0, lon: 0 }];
    intercept('get', '/reportes', (request) => {
      expect(request.method).toBe('GET');
      const url = new URL(request.url);
      expect([...url.searchParams.keys()]).toEqual(['_t']);
      expect(Number(url.searchParams.get('_t'))).toBeGreaterThan(0);
    }, data);
    expect(await api.get(API_CONFIG.ENDPOINTS.REPORTES)).toEqual(data);
  });
  it('gets safe points independently of reports', async () => {
    const data = [{ id: 17, nombre: 'Centro', horario: '9–18', lat: 21, lon: -102 }];
    intercept('get', '/puntos-seguros', () => {}, data);
    expect(await api.get(API_CONFIG.ENDPOINTS.PUNTOS_SEGUROS)).toEqual(data);
  });
  it('encodes the report ID on comments GET, including zero', async () => {
    const data = [{ id: 1, report_id: 0, user_name: 'Ana', text: 'Lo vi', timestamp: 1 }];
    intercept('get', '/comentarios', request => expect(new URL(request.url).searchParams.get('report_id')).toBe('0'), data);
    expect(await api.get('/comentarios', { report_id: 0 })).toEqual(data);
  });
  it('posts a comment as exactly report_id, user_name and text JSON', async () => {
    const payload = { report_id: 17, user_name: 'Ana', text: 'Encontré algo similar.' };
    intercept('post', '/comentar', async request => {
      expect(request.headers.get('content-type')).toBe('application/json');
      expect(await request.json()).toEqual(payload);
    }, { ok: true, id: 21 });
    expect(await api.post('/comentar', payload, true)).toEqual({ ok: true, id: 21 });
  });
  it('publishes the real multipart builder output, including timestamp and the photo bytes', async () => {
    const fields = new FormData();
    const values = { description: 'Audífonos', category: 'Electrónica', phone: '', security_question: 'Color', security_answer: 'Azul', lat: '0', lon: '-102.29', status: 'FOUND' };
    Object.entries(values).forEach(([key, value]) => fields.set(key, value));
    const photo = new File(['image-bytes'], 'objeto.jpg', { type: 'image/jpeg' });
    const body = createReportFormData({ user: { sub: 'user-7', email: 'ana@example.test' }, fields, photo, now: 1234567890000 });
    intercept('post', '/reportar', async request => {
      expect(request.headers.get('content-type')).toMatch(/^multipart\/form-data; boundary=/);
      const parsed = await request.formData();
      expect([...parsed.keys()].sort()).toEqual(['user_id','email','phone','description','category','latitude','longitude','security_question','security_answer','status','timestamp','foto'].sort());
      expect(Object.fromEntries([...parsed].filter(([key]) => key !== 'foto'))).toEqual({
        user_id: 'user-7', email: 'ana@example.test', phone: '', description: 'Audífonos', category: 'Electrónica', latitude: '0', longitude: '-102.29', security_question: 'Color', security_answer: 'Azul', status: 'FOUND', timestamp: '1234567890'
      });
      expect(parsed.get('foto').name).toBe('objeto.jpg');
      expect(parsed.get('foto').type).toBe('image/jpeg');
      expect(await parsed.get('foto').text()).toBe('image-bytes');
    }, { ok: true, id: 30 });
    expect(await api.post('/reportar', body)).toEqual({ ok: true, id: 30 });
  });
  it('preserves multipart fallbacks and does not invent a photo', () => {
    const fields = new FormData();
    for (const key of ['description','category','phone','security_question','security_answer','lat','lon']) fields.set(key, '');
    const body = createReportFormData({ user: {}, fields, now: 1000 });
    expect(body.get('user_id')).toBe('anon');
    expect(body.get('email')).toBe('');
    expect(body.get('status')).toBe('LOST');
    expect(body.has('foto')).toBe(false);
  });
  it('deletes the specific report with the existing user_id query', async () => {
    intercept('delete', '/reportes/:id', async (request, params) => {
      expect(params.id).toBe('17');
      const url = new URL(request.url);
      expect([...url.searchParams]).toEqual([['user_id', 'user/7']]);
      expect(await request.text()).toBe('');
    }, { ok: true });
    expect(await api.delete('/reportes/17', { user_id: 'user/7' })).toEqual({ ok: true });
  });
  it('encodes email plus signs in alert parameters', async () => {
    intercept('get', '/mis-alertas', request => expect(new URL(request.url).searchParams.get('email')).toBe('ana+web@example.test'), [{ id: 2 }]);
    expect(await api.get('/mis-alertas', { email: 'ana+web@example.test' })).toEqual([{ id: 2 }]);
  });
  it('supports the documented user-type GET through the shared client', async () => {
    intercept('get', '/usuario/tipo', request => expect(new URL(request.url).searchParams.get('email')).toBe('ana@example.test'), { tipo: 'normal' });
    expect(await api.get('/usuario/tipo', { email: 'ana@example.test' })).toEqual({ tipo: 'normal' });
  });
  it('propagates HTTP 429 on report publication without retrying or claiming success', async () => {
    let requests = 0;
    server.use(http.post(base + '/reportar', () => { requests++; return HttpResponse.json({ error: 'Cinco diarios o veinte semanales' }, { status: 429 }); }));
    await expect(api.post('/reportar', new FormData())).rejects.toThrow('API Error: 429');
    expect(requests).toBe(1);
  });
  it('propagates a reports HTTP 500', async () => {
    server.use(http.get(base + '/reportes', () => HttpResponse.json({ error: 'Unavailable' }, { status: 500 })));
    await expect(api.get('/reportes')).rejects.toThrow('API Error: 500');
  });
  it('propagates comment HTTP 500 and deletion HTTP 403', async () => {
    server.use(http.post(base + '/comentar', () => new HttpResponse(null, { status: 500 })), http.delete(base + '/reportes/17', () => new HttpResponse(null, { status: 403 })));
    await expect(api.post('/comentar', { report_id: 17, user_name: 'Ana', text: 'Texto' }, true)).rejects.toThrow('API Error: 500');
    await expect(api.delete('/reportes/17')).rejects.toThrow('API Error: 403');
  });
  it('rejects a network failure', async () => {
    server.use(http.get(base + '/reportes', () => HttpResponse.error()));
    await expect(api.get('/reportes')).rejects.toThrow();
  });
  it('rejects malformed JSON rather than silently succeeding', async () => {
    server.use(http.get(base + '/reportes', () => new HttpResponse('{broken', { headers: { 'Content-Type': 'application/json' } })));
    await expect(api.get('/reportes')).rejects.toThrow(SyntaxError);
  });
  it('preserves incomplete records for the existing presentation normalizer', async () => {
    intercept('get', '/reportes', () => {}, [{ id: 7 }, null, {}]);
    expect(await api.get('/reportes')).toEqual([{ id: 7 }, null, {}]);
  });
  it('omits null/undefined query values without dropping false or zero', async () => {
    intercept('get', '/reportes', request => {
      const params = new URL(request.url).searchParams;
      expect(params.has('missing')).toBe(false);
      expect(params.has('absent')).toBe(false);
      expect(params.get('zero')).toBe('0');
      expect(params.get('boolean')).toBe('false');
    }, []);
    expect(await api.get('/reportes', { missing: null, absent: undefined, zero: 0, boolean: false })).toEqual([]);
  });
  it('retains successful data when the parallel safe-point request fails', async () => {
    server.use(
      http.get(base + '/reportes', () => HttpResponse.json([{ id: 7 }])),
      http.get(base + '/puntos-seguros', () => new HttpResponse(null, { status: 500 })),
      http.get(base + '/config', () => HttpResponse.json({ colores_mapa: {} })),
      http.get(base + '/mis-alertas', () => HttpResponse.json([]))
    );
    const result = await api.fetchData({ email: 'ana@example.test' });
    expect(result.map(item => item.status)).toEqual(['fulfilled','rejected','fulfilled','fulfilled']);
    expect(result[0].value).toEqual([{ id: 7 }]);
    expect(result[1].reason.message).toBe('API Error: 500');
  });
  it('does not request alerts for an anonymous aggregate load', async () => {
    server.use(...['/reportes','/puntos-seguros','/config'].map(endpoint => http.get(base + endpoint, () => HttpResponse.json([]))));
    const result = await api.fetchData(null);
    expect(result).toHaveLength(3);
    expect(result.every(item => item.status === 'fulfilled')).toBe(true);
  });
  it('aborts a stalled GET using the configured timeout', async () => {
    server.use(http.get(base + '/reportes', async () => { await delay(300); return HttpResponse.json([]); }));
    const fastApi = new ApiService({ baseUrl: base, timeoutMs: 60 });
    await expect(fastApi.get('/reportes')).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('uses the server origin for photos and preserves absolute photo URLs', () => {
    expect(api.resolveUrl('/photos/objeto.jpg')).toBe('https://lostnet.test/photos/objeto.jpg');
    expect(api.resolveUrl('https://photos.example.test/a.jpg')).toBe('https://photos.example.test/a.jpg');
  });
});
