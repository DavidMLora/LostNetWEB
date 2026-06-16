/**
 * LOSTNET CLIENT APP
 * Versión: FINAL v8.5 - Corregido para MySQL (Principal) + MongoDB (Secundario)
 * Servidor: http://10.155.13.62:5000 vía VPN
 */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';

import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

const NEARBY_RADIUS_METERS = 2500;

const CONFIG = {
  SERVER_URL: 'http://10.155.13.62:5000',
  API_BASE_URL: 'http://10.155.13.62:5000/api',

  GOOGLE_CLIENT_ID: '131580325520-73jrf8i9o54nhitc64etc4ppk41qkin4.apps.googleusercontent.com',
  DEFAULT_COORDS: [21.88, -102.29],
  DEFAULT_ZOOM: 13,
  GPS_ZOOM: 16,
  // Timeout generoso para la VPN
  TIMEOUT_MS: 10000,
  ROUTES: { LOGIN: '/', DASHBOARD: '/dashboard' },
  ENDPOINTS: {
    REPORTES: '/reportes',
    REPORTAR: '/reportar',
    PUNTOS_SEGUROS: '/puntos-seguros',
    // Alertas del buzón MySQL (Harvester)
    ALERTAS: '/mis-alertas',
    CONFIG: '/config',
    COMENTARIOS_GET: '/comentarios',
    COMENTAR_POST: '/comentar',
    // Perfil de gamificación desde MongoDB
    PERFIL: '/perfil',
    USUARIO_TIPO: '/usuario/tipo',
  },
  VALID_CATEGORIES: ['Electrónica', 'Ropa', 'Documentos', 'Otros'],
  // Mapeo frontend → valor guardado en MySQL
  CATEGORY_MAP: {
    'Electrónica': 'ELECTRONICS',
    'Ropa': 'CLOTHING',
    'Documentos': 'DOCUMENTS',
    'Otros': 'OTHERS',
  },
  // Mapeo inverso MySQL → frontend
  CATEGORY_REVERSE: {
    'ELECTRONICS': 'Electrónica',
    'CLOTHING': 'Ropa',
    'DOCUMENTS': 'Documentos',
    'OTHERS': 'Otros',
    'OTROS': 'Otros',
  },
  COLORS: { propio: '#2563EB', ajeno: '#EF4444', seguro: '#10B981' }
};

// ─── UTILS ──────────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return 'Usuario';
  const parts = email.split('@');
  return parts.length < 2 ? 'Usuario' : `${parts[0].substring(0, 2)}***@${parts[1]}`;
};

const showToast = (message, type = 'info') => {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden', 'bg-gray-900', 'bg-green-600', 'bg-red-600', 'bg-yellow-500');
  if (type === 'success') toast.classList.add('bg-green-600');
  else if (type === 'error') toast.classList.add('bg-red-600');
  else if (type === 'warning') toast.classList.add('bg-yellow-500');
  else toast.classList.add('bg-gray-900');
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3500);
};

const getDistanceInMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Normaliza coords: el backend MySQL guarda lat/lon,
 * pero a veces llegan como latitude/longitude desde formularios.
 */
const getCoords = (item) => ({
  lat: parseFloat(item.lat ?? item.latitude ?? 0),
  lon: parseFloat(item.lon ?? item.longitude ?? 0),
});

/**
 * Normaliza categoría: convierte valor MySQL a etiqueta legible.
 */
const normalizeCategory = (cat) => {
  if (!cat) return 'Otros';
  return CONFIG.CATEGORY_REVERSE[cat] || (CONFIG.VALID_CATEGORIES.includes(cat) ? cat : 'Otros');
};

/**
 * Devuelve la descripción/título del reporte desde cualquier campo posible.
 */
const getReportTitle = (r) =>
  r.desc_short || r.description || r.descripcion || 'Sin título';

const isReportOwner = (r, currentUser) => {
  if (!currentUser) return false;
  return (
    r.user_id === currentUser.sub ||
    r.email === currentUser.email ||
    // El backend enmascara el email; comparamos el inicio
    (r.email && currentUser.email && r.email.startsWith(currentUser.email.substring(0, 2)))
  );
};

const getNearbyReports = (reports, userLocation, radiusMeters) => {
  if (!userLocation) return [];
  return reports.filter((r) => {
    const { lat, lon } = getCoords(r);
    if (!lat || !lon) return false;
    return getDistanceInMeters(userLocation.lat, userLocation.lon, lat, lon) <= radiusMeters;
  });
};

function decodeJwtResponse(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

const injectCustomStyles = () => {
  const style = document.createElement('style');
  style.innerHTML = `
    .routing-container-custom {
      background-color: rgba(255,255,255,0.95) !important;
      backdrop-filter: blur(8px);
      border-radius: 12px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
      border: 1px solid rgba(229,231,235,0.8);
      font-family: ui-sans-serif,system-ui,-apple-system,sans-serif;
      position: fixed !important; right: 20px !important; top: 80px !important;
      left: auto !important; bottom: auto !important; max-width: 320px;
      color: #1f2937; z-index: 9999 !important;
    }
    .leaflet-routing-container h2 { display: none; }
    .leaflet-routing-alt table { margin-bottom: 5px; width: 100%; }
    .leaflet-routing-alt { max-height: 300px; overflow-y: auto; scrollbar-width: thin; }
    .leaflet-routing-alt:not(:first-of-type) { display: none !important; }
    @media print { .routing-container-custom { display: none; } }
  `;
  document.head.appendChild(style);
};

// ─── SESSION MANAGER ────────────────────────────────────────────────────────

const SessionManager = {
  saveUser(user) {
    localStorage.setItem('lostnet_user', JSON.stringify(user));
    if (user.email) localStorage.setItem('user_email', user.email);
    if (user.sub) localStorage.setItem('user_id', user.sub);
    if (user.name) localStorage.setItem('user_name', user.name);
  },
  getUser() {
    const raw = localStorage.getItem('lostnet_user');
    if (raw) {
      try { return JSON.parse(raw); } catch { /* noop */ }
    }
    const email = localStorage.getItem('user_email');
    if (email) {
      return {
        email,
        name: localStorage.getItem('user_name'),
        picture: localStorage.getItem('user_photo'),
        sub: localStorage.getItem('user_id'),
        given_name: localStorage.getItem('user_name'),
      };
    }
    return null;
  },
  logout() {
    ['lostnet_user', 'user_email', 'user_name', 'user_photo', 'user_id'].forEach(
      (k) => localStorage.removeItem(k)
    );
    window.location.href = CONFIG.ROUTES.LOGIN;
  },
  guard() {
    const user = this.getUser();
    const path = window.location.pathname;
    if (path.includes('/dashboard') && !user) {
      window.location.href = CONFIG.ROUTES.LOGIN;
      return null;
    }
    if ((path === CONFIG.ROUTES.LOGIN || path === '/') && user) {
      window.location.href = CONFIG.ROUTES.DASHBOARD;
    }
    return user;
  },
};

// ─── API SERVICE ─────────────────────────────────────────────────────────────

class ApiService {
  constructor() {
    this.baseUrl = CONFIG.API_BASE_URL;
  }

  _buildUrl(endpoint, params = {}) {
    // Usamos URL solo si el endpoint no empieza con http
    const full = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const url = new URL(full);
    // Cache-buster para evitar datos obsoletos
    url.searchParams.append('_t', Date.now());
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== '') url.searchParams.append(k, v);
    });
    return url.toString();
  }

  async get(endpoint, params = {}) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);
    try {
      const res = await fetch(this._buildUrl(endpoint, params), {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(tid);
      if (!res.ok) throw new Error(`HTTP ${res.status} en GET ${endpoint}`);
      return await res.json();
    } catch (err) {
      clearTimeout(tid);
      throw err;
    }
  }

  /**
   * POST multipart (FormData) o JSON.
   * El backend /api/reportar espera FormData (foto incluida).
   * /api/comentar espera JSON.
   */
  async post(endpoint, body, isJson = false) {
    const controller = new AbortController();
    // Subida de fotos puede tardar más
    const tid = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS * 6);
    const url = `${this.baseUrl}${endpoint}`;
    const options = { method: 'POST', signal: controller.signal, body };
    if (isJson) {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(body);
    }
    try {
      const res = await fetch(url, options);
      clearTimeout(tid);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt}`);
      }
      return await res.json();
    } catch (err) {
      clearTimeout(tid);
      throw err;
    }
  }

  async delete(endpoint) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);
    const url = `${this.baseUrl}${endpoint}`;
    try {
      const res = await fetch(url, { method: 'DELETE', signal: controller.signal });
      clearTimeout(tid);
      if (!res.ok) throw new Error(`HTTP ${res.status} en DELETE ${endpoint}`);
      return await res.json();
    } catch (err) {
      clearTimeout(tid);
      throw err;
    }
  }

  /**
   * Carga en paralelo: reportes (MySQL), puntos seguros (MySQL),
   * config (MySQL), alertas del buzón (MySQL) y perfil (MongoDB).
   */
  async fetchData(currentUser) {
    const promises = [
      this.get(CONFIG.ENDPOINTS.REPORTES),
      this.get(CONFIG.ENDPOINTS.PUNTOS_SEGUROS),
      this.get(CONFIG.ENDPOINTS.CONFIG).catch(() => null),
    ];
    if (currentUser?.email) {
      // Alertas del Harvester guardadas en MySQL t7_buzon
      promises.push(
        this.get(CONFIG.ENDPOINTS.ALERTAS, { email: currentUser.email }).catch(() => [])
      );
      // Perfil de gamificación desde MongoDB
      promises.push(
        this.get(CONFIG.ENDPOINTS.PERFIL, { email: currentUser.email }).catch(() => null)
      );
    }
    return Promise.allSettled(promises);
  }

  /**
   * Resuelve la URL completa de una foto.
   * El backend guarda rutas como "/photos/img_xxx.jpg".
   */
  resolveUrl(path) {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${CONFIG.SERVER_URL}${path}`;
  }
}

// ─── VIEW MODAL (DETALLES + WHATSAPP + COMENTARIOS) ─────────────────────────

const ViewModal = {
  init(apiService) {
    this.api = apiService;
    this.modal = $('view-modal');
    this.content = $('view-modal-content');
    this.btnClose = $('btn-close-view');
    if (this.btnClose) this.btnClose.onclick = () => this.close();
  },

  async open(report) {
    if (!this.modal) return;
    this.modal.classList.remove('hidden');

    const imgUrl = this.api.resolveUrl(report.photo_url || report.imagen_url);
    const displayDesc = getReportTitle(report);
    const user = SessionManager.getUser();
    const catLabel = normalizeCategory(report.category);

    this.content.innerHTML = `
      <div class="relative w-full h-64 bg-gray-100 group">
        ${imgUrl
          ? `<img src="${imgUrl}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" onerror="this.parentElement.innerHTML='<div class=\\'flex items-center justify-center h-full text-4xl text-gray-300\\'>📦</div>'">`
          : `<div class="flex items-center justify-center h-full text-4xl text-gray-300">📦</div>`
        }
        <div class="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-12">
          <span class="bg-blue-600 text-white text-xs px-2 py-0.5 rounded uppercase font-bold shadow-sm">${catLabel}</span>
          <h2 class="text-white font-bold text-xl mt-1 shadow-sm leading-tight">${displayDesc}</h2>
        </div>
      </div>

      <div class="p-5 space-y-5 bg-white">
        <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm shadow-sm">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-lg">👤</span>
            <div>
              <p class="font-bold text-gray-700 text-xs uppercase">Publicado por</p>
              <p class="text-gray-600">${report.email ? maskEmail(report.email) : 'Anónimo'}</p>
            </div>
          </div>
          ${report.security_question && report.security_question !== 'N/A'
            ? `<div class="mt-3 pt-3 border-t border-slate-200">
                 <div class="flex items-start gap-2">
                   <span class="text-lg">🔒</span>
                   <div>
                     <p class="text-xs text-orange-600 font-bold uppercase">Pregunta de Seguridad</p>
                     <p class="text-gray-700 italic text-sm mt-0.5">"${report.security_question}"</p>
                   </div>
                 </div>
               </div>`
            : ''}
        </div>

        ${report.phone && String(report.phone).trim() !== ''
          ? `<button id="btn-whatsapp-action" class="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 transition-transform active:scale-95">
               <span class="text-2xl">💬</span>
               <div class="text-left leading-tight">
                 <span class="block text-xs font-normal opacity-90">¿Lo encontraste?</span>
                 <span class="block">Enviar mensaje WhatsApp</span>
               </div>
             </button>`
          : `<div class="text-center text-xs text-gray-400 bg-gray-50 p-3 rounded-lg border border-dashed border-gray-200">Este reporte no tiene teléfono de contacto público.</div>`
        }

        <hr class="border-gray-100">

        <div class="flex flex-col h-72">
          <h3 class="font-bold text-gray-700 mb-3 flex items-center gap-2 text-sm">
            <span>💬</span> Comentarios de la Comunidad
          </h3>
          <div id="comments-list" class="flex-1 overflow-y-auto bg-gray-50 p-3 rounded-xl mb-3 border border-gray-100">
            <p class="text-center text-xs text-gray-400 py-8">Cargando comentarios...</p>
          </div>
          <div class="flex gap-2">
            <input id="comment-input" type="text" placeholder="Escribe algo útil..."
                   class="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all">
            <button id="btn-send-comment" class="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors shadow-sm">➤</button>
          </div>
        </div>
      </div>
    `;

    // WhatsApp
    const btnWa = $('btn-whatsapp-action');
    if (btnWa && report.phone) {
      btnWa.onclick = () => {
        const text = `Hola, vi en LostNet que perdiste tu ${displayDesc}. ¡Creo que yo lo encontré! ¿Dónde nos vemos?`;
        const phoneClean = String(report.phone).replace(/\D/g, '');
        window.open(`https://wa.me/${phoneClean}?text=${encodeURIComponent(text)}`, '_blank');
      };
    }

    // Cargar comentarios desde MySQL t8_comentarios
    this._loadComments(report.id);

    // Enviar comentario → POST /api/comentar (JSON) → MySQL t8_comentarios
    const btnSend = $('btn-send-comment');
    const inputComment = $('comment-input');
    if (btnSend && inputComment) {
      btnSend.onclick = async () => {
        const text = inputComment.value.trim();
        if (!text) return;
        const tempComment = {
          user_name: user?.given_name || user?.name || 'Yo',
          text,
          timestamp: Math.floor(Date.now() / 1000),
        };
        this._renderComment(tempComment, true);
        inputComment.value = '';
        try {
          await this.api.post(
            CONFIG.ENDPOINTS.COMENTAR_POST,
            {
              report_id: report.id,
              user_name: user?.given_name || user?.name || 'Usuario LostNet',
              text,
            },
            true  // isJson → Content-Type: application/json
          );
        } catch (err) {
          console.error('Error comentando:', err);
          showToast('Error de conexión al comentar.', 'error');
        }
      };
      // También enviar con Enter
      inputComment.onkeydown = (e) => { if (e.key === 'Enter') btnSend.click(); };
    }
  },

  async _loadComments(reportId) {
    const list = $('comments-list');
    if (!list) return;
    try {
      // GET /api/comentarios?report_id=XXX → MySQL t8_comentarios
      const comments = await this.api.get(CONFIG.ENDPOINTS.COMENTARIOS_GET, { report_id: reportId });
      list.innerHTML = '';
      if (!comments || comments.length === 0) {
        list.innerHTML = `
          <div class="flex flex-col items-center justify-center h-full text-gray-400 opacity-50">
            <span class="text-3xl mb-2">💭</span>
            <p class="text-xs">Sé el primero en comentar.</p>
          </div>`;
      } else {
        comments.forEach((c) => this._renderComment(c));
      }
    } catch {
      list.innerHTML = '<p class="text-center text-xs text-red-400 py-4">Error de red al cargar comentarios.</p>';
    }
  },

  _renderComment(c, isNew = false) {
    const list = $('comments-list');
    if (!list) return;
    // Eliminar estado vacío si existe
    const empty = list.querySelector('.flex-col');
    if (empty) list.innerHTML = '';

    const div = document.createElement('div');
    div.className = `bg-white p-3 rounded-lg shadow-sm border border-gray-100 text-sm mb-2 last:mb-0${isNew ? ' border-blue-100' : ''}`;
    const dateStr = c.timestamp
      ? new Date(Number(c.timestamp) * 1000).toLocaleDateString()
      : 'Justo ahora';
    div.innerHTML = `
      <div class="flex justify-between items-center mb-1">
        <span class="font-bold text-gray-800 text-xs bg-gray-100 px-1.5 py-0.5 rounded">${c.user_name || 'Anónimo'}</span>
        <span class="text-[10px] text-gray-400">${dateStr}</span>
      </div>
      <p class="text-gray-600 leading-snug pl-1">${c.text}</p>`;
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
  },

  close() {
    this.modal?.classList.add('hidden');
  },
};

// ─── MAP CONTROLLER ──────────────────────────────────────────────────────────

class MapController {
  constructor(elementId) {
    this.elementId = elementId;
    this.map = null;
    this.markers = L.layerGroup();
    this.markerMap = {};
    this.userLocation = null;
    this.routingControl = null;
    this.colors = { ...CONFIG.COLORS };
  }

  init(coords, zoom) {
    if (this.map || !$(this.elementId)) return;
    this.map = L.map(this.elementId, { zoomControl: false }).setView(coords, zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© LostNet',
    }).addTo(this.map);
    this.markers.addTo(this.map);
  }

  // Aplica colores desde /api/config (MySQL config_cliente)
  setColors(serverColors) {
    if (!serverColors) return;
    this.colors = {
      propio: serverColors.pin_propio || this.colors.propio,
      ajeno: serverColors.pin_ajeno || this.colors.ajeno,
      seguro: serverColors.pin_seguro || this.colors.seguro,
    };
  }

  updateUserLocation(lat, lon) {
    this.userLocation = { lat, lon };
    if (this.userMarker) this.map.removeLayer(this.userMarker);
    if (this.userAccuracy) this.map.removeLayer(this.userAccuracy);
    this.userAccuracy = L.circle([lat, lon], { radius: 20, color: '#3B82F6', fillOpacity: 0.2 }).addTo(this.map);
    this.userMarker = L.circleMarker([lat, lon], { radius: 6, color: '#3B82F6', fillOpacity: 1, stroke: false }).addTo(this.map);
  }

  flyToUser() {
    if (this.userLocation) this.map.flyTo([this.userLocation.lat, this.userLocation.lon], CONFIG.GPS_ZOOM);
  }

  flyToLocation(lat, lon) {
    this.map?.flyTo([lat, lon], CONFIG.GPS_ZOOM, { animate: true, duration: 1.0 });
  }

  clearRoute() {
    if (this.routingControl) {
      this.map.removeControl(this.routingControl);
      this.routingControl = null;
    }
    document.querySelectorAll('.routing-container-custom').forEach((c) => c.remove());
  }

  drawRouteTo(destLat, destLon, profile = 'driving') {
    if (!this.userLocation) {
      showToast("Necesitamos tu ubicación primero. Presiona el botón de 'Ubicarme'.", 'warning');
      return;
    }
    this.clearRoute();
    const isWalking = profile === 'walking';
    const serviceUrl = isWalking
      ? 'https://routing.openstreetmap.de/routed-foot/route/v1'
      : 'https://routing.openstreetmap.de/routed-car/route/v1';
    const lineColor = isWalking ? '#10B981' : '#6366F1';
    const lineStyle = isWalking
      ? [{ color: lineColor, opacity: 0.8, weight: 5, dashArray: '10, 10' }]
      : [{ color: lineColor, opacity: 0.8, weight: 5 }];

    this.routingControl = L.Routing.control({
      waypoints: [
        L.latLng(this.userLocation.lat, this.userLocation.lon),
        L.latLng(destLat, destLon),
      ],
      router: L.Routing.osrmv1({ serviceUrl, profile: isWalking ? 'foot' : 'driving' }),
      language: 'es',
      lineOptions: { styles: lineStyle },
      routeWhileDragging: false,
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      showAlternatives: false,
      position: 'topright',
      containerClassName: 'routing-container-custom',
      createMarker(i, wp, nWps) {
        if (i !== 0 && i !== nWps - 1) return null;
        return L.marker(wp.latLng, {
          draggable: false,
          icon: L.divIcon({
            className: 'route-marker',
            html: `<div style="width:12px;height:12px;background:${i === 0 ? '#3B82F6' : '#8B5CF6'};border-radius:50%;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>`,
          }),
        });
      },
    }).addTo(this.map);
  }

  clear() {
    this.markers.clearLayers();
    this.markerMap = {};
    this.clearRoute();
  }

  openMarkerPopup(id) {
    this.markerMap[id]?.openPopup();
  }

  _generatePopupButtons(id, isOwner) {
    const btnCarId = `btn-car-${id}`;
    const btnWalkId = `btn-walk-${id}`;
    const btnDeleteId = `btn-delete-${id}`;
    const btnDetailsId = `btn-details-${id}`;

    let html = '<div class="flex flex-col gap-2 mt-2">';
    html += `<button id="${btnDetailsId}" class="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1.5 px-2 rounded flex items-center justify-center gap-1">💬 Ver Detalles / Comentar</button>`;
    html += `<div class="flex gap-2">
               <button id="${btnCarId}" class="flex-1 bg-white border border-gray-300 hover:bg-blue-50 text-blue-700 text-xs font-bold py-1.5 px-1 rounded flex items-center justify-center gap-1" title="Ruta en Auto">🚗</button>
               <button id="${btnWalkId}" class="flex-1 bg-white border border-gray-300 hover:bg-green-50 text-green-700 text-xs font-bold py-1.5 px-1 rounded flex items-center justify-center gap-1" title="Ruta a Pie">🚶</button>
             </div>`;
    if (isOwner) {
      html += `<button id="${btnDeleteId}" class="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold py-1.5 px-2 rounded flex items-center justify-center gap-1">🗑️ Eliminar Reporte</button>`;
    }
    html += '</div>';
    return { html, btnCarId, btnWalkId, btnDeleteId, btnDetailsId };
  }

  addMarker(data, type, options = {}) {
    const { lat, lon } = getCoords(data);
    // Coordenada (0,0) o inválida → ignorar
    if (!lat || !lon || (lat === 0 && lon === 0)) return null;

    const isSafePoint = type === 'SAFE_POINT';
    const isOwner = !!options.isOwner;

    let color, title, iconHtml;
    if (isSafePoint) {
      color = this.colors.seguro;
      title = 'Punto Seguro';
      iconHtml = `<div style="width:18px;height:18px;background:${color};border-radius:4px;transform:rotate(45deg);border:2px solid white;box-shadow:0 0 5px rgba(0,255,0,0.5);"></div>`;
    } else {
      color = isOwner ? this.colors.propio : this.colors.ajeno;
      title = isOwner ? 'Tu reporte' : 'Objeto Perdido';
      iconHtml = `<div style="width:16px;height:16px;background:${color};border-radius:50%;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>`;
    }

    const uid = Math.random().toString(36).substr(2, 9);
    const buttons = this._generatePopupButtons(uid, isOwner);
    const catLabel = normalizeCategory(data.category);
    const displayDesc = getReportTitle(data);
    const imgUrl = options.imageUrl;

    const popupContent = `
      <div class="min-w-[200px] font-sans">
        <div class="flex items-center gap-2 mb-1">
          <h3 class="font-bold text-base" style="color:${color}">${title}</h3>
          ${!isSafePoint ? `<span class="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200 ml-auto">${catLabel}</span>` : ''}
        </div>
        ${isSafePoint
          ? `<p class="font-semibold text-gray-800 text-sm">${data.nombre}</p><p class="text-xs text-gray-500">${data.horario || ''}</p>`
          : `<p class="text-sm text-gray-800 mb-2 truncate">${displayDesc.substring(0, 40)}...</p>`
        }
        ${imgUrl ? `<div class="cursor-pointer mb-2" id="img-wrap-${uid}"><img src="${imgUrl}" class="w-full h-24 object-cover rounded border border-gray-100" onerror="this.style.display='none'"></div>` : ''}
        ${buttons.html}
      </div>`;

    const marker = L.marker([lat, lon], {
      icon: L.divIcon({ className: isSafePoint ? 'safe-point-marker' : 'custom-marker', html: iconHtml }),
    });
    marker.bindPopup(popupContent);
    marker.addTo(this.markers);

    if (data.id) this.markerMap[data.id] = marker;

    marker.on('popupopen', () => {
      this.clearRoute();

      const imgWrap = $(`img-wrap-${uid}`);
      if (imgWrap) imgWrap.onclick = () => ViewModal.open(data);

      $(`${buttons.btnDetailsId}`)?.addEventListener('click', () => ViewModal.open(data));
      $(`${buttons.btnCarId}`)?.addEventListener('click', () => this.drawRouteTo(lat, lon, 'driving'));
      $(`${buttons.btnWalkId}`)?.addEventListener('click', () => this.drawRouteTo(lat, lon, 'walking'));

      if (isOwner) {
        $(`${buttons.btnDeleteId}`)?.addEventListener('click', () => {
          options.onDelete?.(data.id);
        });
      }
    });

    return marker;
  }
}

// ─── INIT ────────────────────────────────────────────────────────────────────

const initApp = async () => {
  console.log('🚀 LostNet Client v8.5 — MySQL (Principal) + MongoDB (Secundario)');
  injectCustomStyles();

  const currentUser = SessionManager.guard();
  if (!currentUser && window.location.pathname.includes('/dashboard')) return;

  const api = new ApiService();
  const mapController = new MapController('map');
  ViewModal.init(api);

  const state = {
    allReports: [],
    allSafePoints: [],
    filterText: '',
    selectedCategories: new Set(),
    filterNearby: false,
    filterMine: false,
  };

  let isSelectionMode = false;
  let originalBtnContent = '';

  const ui = {
    menu: $('sidebar-menu'),
    btnMenu: $('btn-menu-toggle'),
    btnCloseMenu: $('btn-close-menu'),
    btnRefresh: $('btn-refresh'),
    btnGps: $('btn-gps'),

    btnNotificationsSidebar: $('btn-notifications-sidebar'),
    notificationsMenu: $('notifications-menu'),
    btnCloseNotifications: $('btn-close-notifications'),
    notificationsList: $('notifications-list'),
    badgeNotifications: $('badge-notifications'),

    inputFilterNearby: $('filter-nearby'),
    inputFilterMine: $('filter-mine'),
    checkboxesCategory: $$('.filter-cat'),

    btnAddReport: $('btn-add-report'),
    btnLogout: $('btn-logout'),
    searchInput: $('search-input'),
    reportsList: $('reports-list'),
    stats: { reportes: $('stat-reportes'), seguros: $('stat-seguros') },
    status: $('status-indicator'),
    loginBtn: $('google-login-btn'),
    modal: $('report-modal'),
    btnCloseModal: $('btn-close-modal'),
    formReport: $('form-report'),
    inputPhoto: $('input-photo'),
    previewImg: $('preview-img'),
    previewContainer: $('preview-container'),
    uploadPlaceholder: $('upload-placeholder'),
    inputLat: $('input-lat'),
    inputLon: $('input-lon'),
  };

  mapController.init(CONFIG.DEFAULT_COORDS, CONFIG.DEFAULT_ZOOM);

  // Clic en mapa para elegir ubicación del reporte
  if (mapController.map && ui.btnAddReport && ui.modal) {
    mapController.map.on('click', (e) => {
      if (!isSelectionMode) return;
      const { lat, lng } = e.latlng;
      if (ui.inputLat) ui.inputLat.value = lat.toFixed(6);
      if (ui.inputLon) ui.inputLon.value = lng.toFixed(6);
      ui.modal.classList.remove('hidden');
      isSelectionMode = false;
      ui.btnAddReport.innerHTML = originalBtnContent;
      ui.btnAddReport.classList.remove('bg-red-600', 'hover:bg-red-700');
      ui.btnAddReport.classList.add('bg-blue-600', 'hover:bg-blue-700');
      $('map').style.cursor = '';
    });
  }

  // ── BORRAR REPORTE → DELETE /api/reportes/:id → borrado lógico en MySQL ──
  const handleDeleteReport = async (reportId) => {
    if (!confirm('⚠️ ¿Estás seguro de que quieres eliminar este reporte?\n\nEsta acción no se puede deshacer.')) return;
    try {
      // Optimista: quitarlo de la lista local
      state.allReports = state.allReports.filter((r) => r.id !== reportId);
      render();
      // Borrado lógico en MySQL: status_logico = 'INACTIVO'
      await api.delete(`${CONFIG.ENDPOINTS.REPORTES}/${reportId}`);
      showToast('Reporte eliminado correctamente.', 'success');
      // Refrescar desde servidor para confirmar
      setTimeout(loadData, 1500);
    } catch (err) {
      console.error('Error al borrar:', err);
      showToast('Error al eliminar el reporte.', 'error');
      loadData();
    }
  };

  // ── RENDER: aplica filtros y pinta mapa + lista lateral ──────────────────
  const render = () => {
    mapController.clear();

    const filtered = state.allReports.filter((r) => {
      const text = getReportTitle(r).toLowerCase();
      const matchText = text.includes(state.filterText.toLowerCase());

      let matchCat = true;
      if (state.selectedCategories.size > 0) {
        matchCat = state.selectedCategories.has(normalizeCategory(r.category));
      }

      let matchDist = true;
      if (state.filterNearby && mapController.userLocation) {
        const { lat, lon } = getCoords(r);
        if (lat && lon) {
          matchDist = getDistanceInMeters(mapController.userLocation.lat, mapController.userLocation.lon, lat, lon) <= NEARBY_RADIUS_METERS;
        } else {
          matchDist = false;
        }
      }

      const matchMine = state.filterMine ? isReportOwner(r, currentUser) : true;
      return matchText && matchCat && matchDist && matchMine;
    });

    if (ui.reportsList) ui.reportsList.innerHTML = '';
    if (filtered.length === 0 && ui.reportsList) {
      ui.reportsList.innerHTML = '<p class="text-center text-gray-400 text-xs py-10">No se encontraron reportes.</p>';
    }

    filtered.forEach((r) => {
      const isOwner = isReportOwner(r, currentUser);
      const imgUrl = api.resolveUrl(r.photo_url || r.imagen_url);
      const catLabel = normalizeCategory(r.category);

      const marker = mapController.addMarker(r, 'REPORT', {
        isOwner,
        imageUrl: imgUrl,
        onDelete: handleDeleteReport,
      });

      if (ui.reportsList) {
        const displayTitle = getReportTitle(r);
        const card = document.createElement('div');
        card.className = 'p-3 bg-white border border-gray-100 rounded-lg hover:shadow-md transition-shadow cursor-pointer flex gap-3 relative group';
        const deleteBtnHtml = isOwner
          ? `<button class="btn-delete-list absolute top-2 right-2 text-gray-400 hover:text-red-500 bg-white/80 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity" title="Eliminar">🗑️</button>`
          : '';
        card.innerHTML = `
          <div class="w-12 h-12 bg-gray-100 rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center bg-slate-50">
            ${imgUrl ? `<img src="${imgUrl}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<span class=\\'text-xl\\'>📦</span>'">` : '<span class="text-xl">📦</span>'}
          </div>
          <div class="flex-1 min-w-0 pr-6">
            <h4 class="text-sm font-bold text-gray-700 truncate">${displayTitle}</h4>
            <div class="flex items-center justify-between mt-1">
              <span class="text-[10px] bg-blue-50 text-blue-600 px-1.5 rounded border border-blue-100">${catLabel}</span>
              <span class="text-[10px] text-gray-400">${r.timestamp ? new Date(Number(r.timestamp) * 1000).toLocaleDateString() : ''}</span>
            </div>
          </div>
          ${deleteBtnHtml}`;

        card.onclick = (e) => {
          if (e.target.closest('.btn-delete-list')) {
            e.stopPropagation();
            handleDeleteReport(r.id);
            return;
          }
          if (marker) {
            const { lat, lon } = getCoords(r);
            mapController.flyToLocation(lat, lon);
            marker.openPopup();
            if (window.innerWidth < 640 && ui.menu) toggleMenu();
          }
        };
        ui.reportsList.appendChild(card);
      }
    });

    // Puntos seguros desde MySQL puntos_seguros
    state.allSafePoints.forEach((s) => mapController.addMarker(s, 'SAFE_POINT'));

    if (ui.stats.reportes) ui.stats.reportes.textContent = filtered.length;
    if (ui.stats.seguros) ui.stats.seguros.textContent = state.allSafePoints.length;
  };

  // ── Badge de notificaciones ──────────────────────────────────────────────
  const refreshNotificationBadge = () => {
    if (!ui.badgeNotifications) return;
    if (!mapController.userLocation) { ui.badgeNotifications.classList.add('hidden'); return; }
    const hasNearby = getNearbyReports(state.allReports, mapController.userLocation, NEARBY_RADIUS_METERS).length > 0;
    ui.badgeNotifications.classList.toggle('hidden', !hasNearby);
  };

  // ── CARGA DE DATOS ───────────────────────────────────────────────────────
  const loadData = async () => {
    try {
      if (!mapController.map) return;
      if (ui.status) ui.status.innerHTML = '<span class="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span> Sincronizando...';

      const results = await api.fetchData(currentUser);
      const [reportsRes, safesRes, configRes] = results;
      const hasErrors = results.some((r) => r.status === 'rejected');

      // /api/config → colores desde MySQL
      if (configRes?.status === 'fulfilled' && configRes.value) {
        mapController.setColors(configRes.value.colores_mapa);
      }

      // /api/reportes → MySQL report_index (solo status_logico='ACTIVO')
      const rawReports = reportsRes?.status === 'fulfilled' ? reportsRes.value : [];
      state.allReports = Array.isArray(rawReports)
        ? rawReports.map((r) => ({
            ...r,
            security_answer: undefined, // nunca mostrar la respuesta cifrada
          }))
        : [];

      // /api/puntos-seguros → MySQL puntos_seguros
      state.allSafePoints = safesRes?.status === 'fulfilled' ? safesRes.value : [];

      // results[3] → alertas del buzón MySQL (si el usuario está logueado)
      // results[4] → perfil MongoDB (si el usuario está logueado)
      if (currentUser?.email && results.length >= 5) {
        const perfilRes = results[4];
        if (perfilRes?.status === 'fulfilled' && perfilRes.value) {
          const perfil = perfilRes.value;
          // Puedes mostrar el rango/medalla en la UI si tienes un elemento para ello
          const badgeEl = $('user-badge');
          if (badgeEl && perfil.rol) badgeEl.textContent = perfil.rol;
        }
      }

      render();
      refreshNotificationBadge();

      if (ui.status) {
        ui.status.innerHTML = hasErrors
          ? '<span class="w-2 h-2 rounded-full bg-red-500"></span> Desconectado'
          : '<span class="w-2 h-2 rounded-full bg-green-500"></span> En línea';
      }
    } catch (err) {
      console.error('Error cargando datos:', err);
      if (ui.status) ui.status.innerHTML = '<span class="w-2 h-2 rounded-full bg-red-500"></span> Error de conexión';
    }
  };

  // ── BOTÓN NUEVO REPORTE ──────────────────────────────────────────────────
  if (ui.btnAddReport) {
    ui.btnAddReport.onclick = () => {
      if (!currentUser) {
        showToast('Inicia sesión para poder reportar un objeto perdido.', 'warning');
        return;
      }
      isSelectionMode = !isSelectionMode;
      if (isSelectionMode) {
        originalBtnContent = ui.btnAddReport.innerHTML;
        ui.btnAddReport.innerHTML = '<span class="text-2xl font-bold">❌</span>';
        ui.btnAddReport.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        ui.btnAddReport.classList.add('bg-red-600', 'hover:bg-red-700');
        $('map').style.cursor = 'crosshair';
        showToast('Haz clic en el mapa donde quieras colocar el reporte.', 'info');
      } else {
        ui.btnAddReport.innerHTML = originalBtnContent;
        ui.btnAddReport.classList.remove('bg-red-600', 'hover:bg-red-700');
        ui.btnAddReport.classList.add('bg-blue-600', 'hover:bg-blue-700');
        $('map').style.cursor = '';
      }
    };
  }

  ui.btnCloseModal?.addEventListener('click', () => ui.modal?.classList.add('hidden'));

  if (ui.inputPhoto) {
    ui.inputPhoto.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ui.previewImg) ui.previewImg.src = ev.target.result;
        ui.previewContainer?.classList.remove('hidden');
        ui.uploadPlaceholder?.classList.add('hidden');
      };
      reader.readAsDataURL(file);
    };
  }

  // ── FORMULARIO DE REPORTE → POST /api/reportar (FormData) → MySQL + MongoDB ──
  if (ui.formReport) {
    ui.formReport.onsubmit = async (e) => {
      e.preventDefault();
      if (!currentUser) return;

      const rawForm = new FormData(ui.formReport);
      const fd = new FormData();

      // Identidad del usuario (se guarda en t1_users MySQL y perfil MongoDB)
      fd.append('user_id', currentUser.sub || 'anon');
      fd.append('email', currentUser.email || '');

      // Datos del reporte (van a report_index MySQL)
      fd.append('description', rawForm.get('description') || '');

      // Convertir categoría legible → valor MySQL
      const catFront = rawForm.get('category') || 'Otros';
      fd.append('category', CONFIG.CATEGORY_MAP[catFront] || 'OTHERS');

      // Teléfono y pregunta de seguridad (el backend cifra con Fernet)
      fd.append('phone', rawForm.get('phone') || '');
      fd.append('security_question', rawForm.get('security_question') || 'N/A');
      fd.append('security_answer', rawForm.get('security_answer') || 'N/A');

      // Coordenadas elegidas en el mapa
      fd.append('latitude', ui.inputLat?.value || '0');
      fd.append('longitude', ui.inputLon?.value || '0');

      // Status siempre LOST al crear
      fd.append('status', 'LOST');
      fd.append('timestamp', Math.floor(Date.now() / 1000).toString());

      // Foto (opcional) — el backend la guarda en /photos/
      if (ui.inputPhoto?.files[0]) {
        fd.append('foto', ui.inputPhoto.files[0]);
      }

      const submitBtn = $('btn-submit-report');
      if (submitBtn) { submitBtn.textContent = '⏳'; submitBtn.disabled = true; }

      try {
        // POST /api/reportar → MySQL report_index + MongoDB perfiles
        // El backend también lanza hilos de geofencing y gamificación
        const result = await api.post(CONFIG.ENDPOINTS.REPORTAR, fd, false);
        showToast(`¡Reporte publicado! ID: ${result.id}`, 'success');
        ui.modal?.classList.add('hidden');
        ui.formReport.reset();
        ui.previewContainer?.classList.add('hidden');
        ui.uploadPlaceholder?.classList.remove('hidden');
        if (ui.previewImg) ui.previewImg.src = '';
        // Esperar un momento antes de refrescar para dar tiempo al servidor
        setTimeout(loadData, 2000);
      } catch (err) {
        console.error('Error al publicar:', err);
        showToast(err.message || 'Error al publicar el reporte.', 'error');
      } finally {
        if (submitBtn) { submitBtn.textContent = 'Publicar Reporte'; submitBtn.disabled = false; }
      }
    };
  }

  ui.btnRefresh?.addEventListener('click', loadData);
  ui.btnLogout?.addEventListener('click', () => SessionManager.logout());

  if (ui.btnGps) {
    ui.btnGps.onclick = () => {
      if (!navigator.geolocation) { showToast('Tu navegador no soporta GPS.', 'error'); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          mapController.updateUserLocation(pos.coords.latitude, pos.coords.longitude);
          mapController.flyToUser();
          refreshNotificationBadge();
        },
        () => showToast('No se pudo obtener tu ubicación.', 'warning')
      );
    };
  }

  ui.searchInput?.addEventListener('input', (e) => {
    state.filterText = e.target.value;
    render();
  });

  // Filtro por cercanía
  ui.inputFilterNearby?.addEventListener('change', (e) => {
    if (e.target.checked && !mapController.userLocation) {
      showToast('Necesitamos tu ubicación. Presiona el botón 📍', 'warning');
      e.target.checked = false;
      return;
    }
    state.filterNearby = e.target.checked;
    render();
  });

  // Filtro "mis reportes"
  ui.inputFilterMine?.addEventListener('change', (e) => {
    state.filterMine = e.target.checked;
    render();
  });

  // Filtro por categoría
  ui.checkboxesCategory.forEach((chk) => {
    chk.addEventListener('change', (e) => {
      if (e.target.checked) state.selectedCategories.add(e.target.value);
      else state.selectedCategories.delete(e.target.value);
      render();
    });
  });

  // ── MENÚ LATERAL ────────────────────────────────────────────────────────
  const toggleMenu = () => {
    if (!ui.menu) return;
    if (window.innerWidth < 1024) {
      ui.menu.classList.toggle('-translate-y-full');
      ui.menu.classList.toggle('sm:-translate-x-full');
    } else {
      ui.menu.classList.toggle('lg:translate-x-0');
    }
  };
  ui.btnMenu?.addEventListener('click', toggleMenu);
  ui.btnCloseMenu?.addEventListener('click', () => {
    ui.menu?.classList.add('-translate-y-full', 'sm:-translate-x-full');
  });

  // ── PANEL DE NOTIFICACIONES (alertas del Harvester) ──────────────────────
  const populateNotifications = () => {
    if (!ui.notificationsList) return;
    if (!mapController.userLocation) {
      ui.notificationsList.innerHTML = '<p class="text-center text-xs text-gray-400 py-10">Presiona 📍 "Ubicarme" primero<br>para ver reportes cercanos.</p>';
      return;
    }
    const nearby = getNearbyReports(state.allReports, mapController.userLocation, NEARBY_RADIUS_METERS);
    if (nearby.length === 0) {
      ui.notificationsList.innerHTML = '<p class="text-center text-xs text-gray-400 py-10">Sin alertas cercanas</p>';
      return;
    }
    ui.notificationsList.innerHTML = '';
    nearby.forEach((r) => {
      const { lat, lon } = getCoords(r);
      const dist = getDistanceInMeters(mapController.userLocation.lat, mapController.userLocation.lon, lat, lon);
      const item = document.createElement('div');
      item.className = 'flex items-center gap-3 p-3 hover:bg-blue-50 rounded cursor-pointer transition-colors border-b border-gray-100 last:border-0';
      item.innerHTML = `
        <div class="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-500">📦</div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-bold text-gray-700 truncate">${getReportTitle(r)}</p>
          <p class="text-[10px] text-blue-500 font-medium">${Math.round(dist)} m</p>
        </div>
        <div class="text-gray-300">›</div>`;
      item.onclick = () => {
        ui.notificationsMenu?.classList.add('translate-x-full');
        ui.badgeNotifications?.classList.add('hidden');
        mapController.flyToLocation(lat, lon);
        setTimeout(() => mapController.openMarkerPopup(r.id), 300);
      };
      ui.notificationsList.appendChild(item);
    });
  };

  const toggleNotificationsSidebar = () => {
    if (!ui.notificationsMenu) return;
    ui.notificationsMenu.classList.toggle('translate-x-full');
    const isOpen = !ui.notificationsMenu.classList.contains('translate-x-full');
    if (isOpen) {
      populateNotifications();
      ui.badgeNotifications?.classList.add('hidden');
    }
  };

  ui.btnNotificationsSidebar?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleNotificationsSidebar();
  });
  ui.btnCloseNotifications?.addEventListener('click', (e) => {
    e.stopPropagation();
    ui.notificationsMenu?.classList.add('translate-x-full');
  });

  // ── GOOGLE LOGIN ─────────────────────────────────────────────────────────
  if (window.google && ui.loginBtn) {
    google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: (res) => {
        const user = decodeJwtResponse(res.credential);
        if (user) {
          SessionManager.saveUser(user);
          // Crear/actualizar perfil en MongoDB vía /api/usuario/tipo
          fetch(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.USUARIO_TIPO}?email=${encodeURIComponent(user.email)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo: 'BUSCADOR' }),
          }).catch(console.error);
          window.location.href = CONFIG.ROUTES.DASHBOARD;
        }
      },
    });
    google.accounts.id.renderButton(ui.loginBtn, {
      theme: 'outline', size: 'large', width: '250', shape: 'pill',
    });
  }

  // ── ARRANQUE ─────────────────────────────────────────────────────────────
  if (mapController.map) {
    await loadData();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          mapController.updateUserLocation(pos.coords.latitude, pos.coords.longitude);
          mapController.flyToUser();
          refreshNotificationBadge();
        },
        () => console.warn('GPS no disponible al inicio.')
      );
    }
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}