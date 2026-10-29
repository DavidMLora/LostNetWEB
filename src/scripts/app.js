/**
 * LOSTNET CLIENT APP
 * Versión: FINAL v8.4 (Conectado al Servidor Principal por VPN)
 */

import L from 'leaflet';
import { initDashboardUI } from './dashboard-ui.js';
import { initReportForm } from './report-form.js';
import { createReportDetail } from './report-detail.js';
import { createReportCard } from './report-cards.js';
import { createReportPopup } from './report-popup.js';
import {
  escapeHtml, icon, getReportTitle, getReportType, getReportCoordinates,
  getReportCategory, formatReportDate, getReportDate, getReportImage, getLocationLabel,
  maskPublicEmail, getWhatsAppLink, getReportKey, getReportDateISO,
  getReportDaysRemaining, uniqueReports
} from './reports-utils.js';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';

import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

const NEARBY_RADIUS_METERS = 2500;
const CONFIG = {
  // --- RUTAS DE LA VPN AL SERVIDOR PRINCIPAL ---
  SERVER_URL: 'https://lostnet-api.tail0e8b19.ts.net',
  API_BASE_URL: 'https://lostnet-api.tail0e8b19.ts.net/api',

  GOOGLE_CLIENT_ID: '131580325520-73jrf8i9o54nhitc64etc4ppk41qkin4.apps.googleusercontent.com',
  DEFAULT_COORDS: [21.88, -102.29],
  DEFAULT_ZOOM: 13,
  GPS_ZOOM: 16,
  TIMEOUT_MS: 5000,
  ROUTES: { LOGIN: '/', DASHBOARD: '/dashboard' },
  ENDPOINTS: {
    REPORTES: '/reportes',
    REPORTAR: '/reportar',
    PUNTOS_SEGUROS: '/puntos-seguros',
    ALERTAS: '/mis-alertas',
    CONFIG: '/config',
    CONTACTO: '/contacto',
    COMENTARIOS_GET: '/comentarios',
    COMENTAR_POST: '/comentar'
  },
  VALID_CATEGORIES: ['Electrónica', 'Ropa', 'Documentos', 'Otros'],
  COLORS: { propio: '#2563EB', ajeno: '#EF4444', seguro: '#10B981' }
};

// ---------- UTILS ----------

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

  toast.classList.remove(
    'hidden',
    'bg-gray-900',
    'bg-green-600',
    'bg-red-600',
    'bg-yellow-500'
  );

  if (type === 'success') toast.classList.add('bg-green-600');
  else if (type === 'error') toast.classList.add('bg-red-600');
  else if (type === 'warning') toast.classList.add('bg-yellow-500');
  else toast.classList.add('bg-gray-900');

  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
};

const getDistanceInMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// helpers para reports

const getCoords = (item) => getReportCoordinates(item) || { lat: null, lon: null };

const normalizeCategory = (cat) =>
  CONFIG.VALID_CATEGORIES.includes(cat) ? cat : 'Otros';

const DAILY_REPORT_LIMIT = 5;
const isCreatedToday = (report, now = new Date()) => {
  const iso = getReportDateISO(report);
  if (!iso) return false;
  const created = new Date(iso);
  return created.getFullYear() === now.getFullYear()
    && created.getMonth() === now.getMonth()
    && created.getDate() === now.getDate();
};

const isReportOwner = (r, currentUser) => {
  if (!currentUser) return false;
  const ownerIdentifier = r.user_id || r.email || '';
  return (
    ownerIdentifier === currentUser.email ||
    ownerIdentifier === currentUser.sub
  );
};

const getNearbyReports = (reports, userLocation, radiusMeters) => {
  if (!userLocation) return [];
  return reports.filter((r) => {
    const { lat, lon } = getCoords(r);
    if (!lat || !lon) return false;
    const dist = getDistanceInMeters(
      userLocation.lat,
      userLocation.lon,
      lat,
      lon
    );
    return dist <= radiusMeters;
  });
};

function decodeJwtResponse(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

const injectCustomStyles = () => {
  const style = document.createElement('style');
  style.innerHTML = `
    .routing-container-custom {
      background-color: rgba(255, 255, 255, 0.95) !important;
      backdrop-filter: blur(8px);
      border-radius: 12px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
      border: 1px solid rgba(229, 231, 235, 0.8);
      font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
      position: fixed !important; right: 88px !important; top: 160px !important;
      left: auto !important; bottom: auto !important; max-width: 320px;
      color: #1f2937; z-index: 50 !important;
    }
    .leaflet-routing-container h2 { display: none; }
    .leaflet-routing-alt table { margin-bottom: 5px; width: 100%; }
    .leaflet-routing-alt { max-height: 300px; overflow-y: auto; scrollbar-width: thin; } 
    .leaflet-routing-alt:not(:first-of-type) { display: none !important; }
    @media (max-width: 767px) {
      .routing-container-custom {
        top: 192px !important; right: 68px !important; left: 14px !important;
        max-width: none; max-height: 170px; overflow-y: auto;
      }
      .leaflet-routing-alt { max-height: 120px; }
    }
    @media print { .routing-container-custom { display: none; } }
  `;
  document.head.appendChild(style);
};

// ---------- SESSION MANAGER ----------

const SessionManager = {
  saveUser: (user) => {
    localStorage.setItem('lostnet_user', JSON.stringify(user));
    if (user.email) localStorage.setItem('user_email', user.email);
    if (user.sub) localStorage.setItem('user_id', user.sub);
  },
  getUser: () => {
    const jsonUser = localStorage.getItem('lostnet_user');
    if (jsonUser) {
      try {
        return JSON.parse(jsonUser);
      } catch (e) { }
    }
    const email = localStorage.getItem('user_email');
    if (email) {
      return {
        email,
        name: localStorage.getItem('user_name'),
        picture: localStorage.getItem('user_photo'),
        sub: localStorage.getItem('user_id'),
        given_name: localStorage.getItem('user_name')
      };
    }
    return null;
  },
  logout: () => {
    ['lostnet_user', 'user_email', 'user_name', 'user_photo', 'user_id'].forEach(
      (k) => localStorage.removeItem(k)
    );
    window.location.href = CONFIG.ROUTES.LOGIN;
  },
  guard: () => {
    const user = SessionManager.getUser();
    const path = window.location.pathname;
    if (path.includes('/dashboard') && !user) {
      window.location.href = CONFIG.ROUTES.LOGIN;
      return null;
    }
    if ((path === CONFIG.ROUTES.LOGIN || path === '/') && user) {
      window.location.href = CONFIG.ROUTES.DASHBOARD;
    }
    return user;
  }
};

// ---------- API SERVICE ----------

class ApiService {
  constructor() {
    this.baseUrl = CONFIG.API_BASE_URL;
  }

  async get(endpoint, params = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);
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
      CONFIG.TIMEOUT_MS * 12
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
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);
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
      this.get(CONFIG.ENDPOINTS.REPORTES),
      this.get(CONFIG.ENDPOINTS.PUNTOS_SEGUROS),
      this.get(CONFIG.ENDPOINTS.CONFIG).catch(() => null)
    ];
    if (currentUser?.email) {
      promises.push(
        this.get(CONFIG.ENDPOINTS.ALERTAS, { email: currentUser.email }).catch(
          () => []
        )
      );
    }
    return Promise.allSettled(promises);
  }

  resolveUrl(path) {
    // Si la ruta ya incluye http, la respeta. Si no, usa el SERVER_URL (no el API_BASE_URL)
    // para que las fotos carguen correctamente desde http://10.155.13.62:5000/photos/...
    return path && !path.startsWith('http') ? `${CONFIG.SERVER_URL}${path}` : path;
  }

  fetchContacto(ownerId) {
    return this.get(CONFIG.ENDPOINTS.CONTACTO, { user_id: ownerId });
  }
}

// ---------- REPORT DETAILS (existing REST contracts) ----------
const ViewModal = createReportDetail({
  getUser: () => SessionManager.getUser(),
  endpoints: CONFIG.ENDPOINTS,
  notify: showToast,
  helpers: {
    getReportTitle, getReportType, getReportCoordinates, getReportCategory,
    getReportDaysRemaining,
    formatReportDate, getReportDate, getReportImage, getLocationLabel, maskPublicEmail, getWhatsAppLink, icon
  }
});

// ---------- MAP CONTROLLER ----------

class MapController {
  constructor(elementId) {
    this.elementId = elementId;
    this.map = null;
    this.markers = L.layerGroup();
    this.markerMap = Object.create(null);
    this.markerRecords = new Map();
    this.markerSyncKeys = null;
    this.userLocation = null;
    this.routingControl = null;
    this.colors = { ...CONFIG.COLORS };
  }

  init(coords, zoom) {
    if (this.map || !$(this.elementId)) return;
    this.map = L.map(this.elementId, { zoomControl: false }).setView(coords, zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · LostNet'
    }).addTo(this.map);
    this.markers.addTo(this.map);
  }

  setColors(serverColors) {
    if (!serverColors) return;
    this.colors = {
      propio: serverColors.pin_propio || this.colors.propio,
      ajeno: serverColors.pin_ajeno || this.colors.ajeno,
      seguro: serverColors.pin_seguro || this.colors.seguro
    };
  }

  updateUserLocation(lat, lon) {
    this.userLocation = { lat, lon };
    if (this.userMarker) this.map.removeLayer(this.userMarker);
    if (this.userAccuracy) this.map.removeLayer(this.userAccuracy);
    this.userAccuracy = L.circle([lat, lon], {
      radius: 20,
      color: '#3B82F6',
      fillOpacity: 0.2
    }).addTo(this.map);
    this.userMarker = L.circleMarker([lat, lon], {
      radius: 6,
      color: '#3B82F6',
      fillOpacity: 1,
      stroke: false
    }).addTo(this.map);
  }

  flyToUser() {
    if (this.userLocation)
      this.map.flyTo(
        [this.userLocation.lat, this.userLocation.lon],
        CONFIG.GPS_ZOOM
      );
  }

  flyToLocation(lat, lon) {
    if (this.map)
      this.map.flyTo([lat, lon], CONFIG.GPS_ZOOM, {
        animate: true,
        duration: 1.0
      });
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
        L.latLng(destLat, destLon)
      ],
      router: L.Routing.osrmv1({
        serviceUrl,
        profile: isWalking ? 'foot' : 'driving'
      }),
      language: 'es',
      lineOptions: { styles: lineStyle },
      routeWhileDragging: false,
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      showAlternatives: false,
      position: 'topright',
      containerClassName: 'routing-container-custom',
      createMarker: function (i, wp, nWps) {
        if (i !== 0 && i !== nWps - 1) return null;
        return L.marker(wp.latLng, {
          draggable: false,
          icon: L.divIcon({
            className: 'route-marker',
            html: `<div style="width: 12px; height: 12px; background: ${i === 0 ? '#3B82F6' : '#8B5CF6'
              }; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`
          })
        });
      }
    }).addTo(this.map);
  }

  clear() {
    this.markers.clearLayers();
    this.markerMap = Object.create(null);
    this.markerRecords.clear();
    this.markerSyncKeys = null;
    this.clearRoute();
  }

  beginMarkerSync() {
    this.markerSyncKeys = new Set();
  }

  endMarkerSync() {
    if (!this.markerSyncKeys) return;
    for (const [key, record] of this.markerRecords) {
      if (this.markerSyncKeys.has(key)) continue;
      this.markers.removeLayer(record.marker);
      if (!record.safe && record.id !== null && this.markerMap[String(record.id)] === record.marker)
        delete this.markerMap[String(record.id)];
      record.marker.off();
      this.markerRecords.delete(key);
    }
    this.markerSyncKeys = null;
  }

  getReportMarker(report, { kind = 'report' } = {}) {
    const namespace = kind === 'safe' ? 'SAFE_POINT:' : 'REPORT:';
    return this.markerRecords.get(namespace + getReportKey(report))?.marker;
  }

  openMarkerPopup(id) {
    if (id === null || id === undefined) return;
    this.markerMap[String(id)]?.openPopup();
  }

  addMarker(data, type, options = {}) {
    const coordinates = getReportCoordinates(data);
    if (!coordinates) return;
    const { lat, lon } = coordinates;
    const safe = type === 'SAFE_POINT';
    const key = (safe ? 'SAFE_POINT:' : 'REPORT:') + getReportKey(data);
    this.markerSyncKeys?.add(key);
    const color = safe ? this.colors.seguro : options.isOwner ? this.colors.propio : this.colors.ajeno;
    const shape = document.createElement('div');
    Object.assign(shape.style, {
      width: safe ? '18px' : '16px', height: safe ? '18px' : '16px',
      backgroundColor: color, borderRadius: safe ? '4px' : '50%',
      border: '2px solid white', boxShadow: '0 1px 6px #16344c40'
    });
    if (safe) shape.style.transform = 'rotate(45deg)';
    const iconClass = safe ? 'safe-point-marker' : 'custom-marker';
    const iconStamp = String(color) + ':' + iconClass;
    let record = this.markerRecords.get(key);
    if (!record) {
      const marker = L.marker([lat, lon], { icon: L.divIcon({ className: iconClass, html: shape.outerHTML }) });
      record = { marker, safe, id: data.id ?? null, lat, lon, iconStamp, data, options };
      this.markerRecords.set(key, record);
      marker.addTo(this.markers);
      marker.on('popupopen', () => {
        this.clearRoute();
        if (!record.safe) record.options.onSelect?.(record.data);
      });
    } else {
      if (record.lat !== lat || record.lon !== lon) record.marker.setLatLng([lat, lon]);
      if (record.iconStamp !== iconStamp)
        record.marker.setIcon(L.divIcon({ className: iconClass, html: shape.outerHTML }));
      Object.assign(record, { lat, lon, iconStamp, data, options });
    }
    const { marker } = record;
    const label = safe ? 'Punto seguro: ' + (data.nombre || 'Sin nombre')
      : getReportType(data).label + (options.isOwner ? ', tu reporte: ' : ': ') + getReportTitle(data);
    marker.getElement()?.setAttribute('aria-label', label);
    const popup = createReportPopup(data, {
      safe, isOwner: Boolean(options.isOwner), imageUrl: options.imageUrl || '',
      onDetails: () => ViewModal.open(record.data, { kind: safe ? 'safe' : 'report' }),
      onDelete: () => record.options.onDelete?.(record.data.id),
      onCar: () => this.drawRouteTo(record.lat, record.lon, 'driving'),
      onWalk: () => this.drawRouteTo(record.lat, record.lon, 'walking')
    });
    if (marker.getPopup()) marker.setPopupContent(popup);
    else marker.bindPopup(popup, { className: 'lostnet-popup', minWidth: 210, maxWidth: 280 });
    // Report IDs live in their own namespace; a safe point can never replace one.
    if (!safe && data.id !== null && data.id !== undefined && String(data.id).trim())
      this.markerMap[String(data.id)] = marker;
    return marker;
  }

}

// ---------- CORE MAIN ----------

const initApp = async () => {
  console.log('🚀 LostNet Client Loaded (v8.4 - Conectado a VPN Principal)');
  injectCustomStyles();

  const currentUser = SessionManager.guard();
  if (!currentUser && window.location.pathname.includes('/dashboard')) return;

  const api = new ApiService();
  const mapController = new MapController('map');
  const dashboardUI = initDashboardUI(currentUser);

  const state = {
    allReports: [],
    allSafePoints: [],
    filterText: '',
    selectedCategories: new Set(),
    filterNearby: false,
    filterMine: false
  };

  let isSelectionMode = false;
  let connectionState = 'loading';
  let reportsLoading = false;
  let reportsHaveSnapshot = false;
  let safePointsHaveSnapshot = false;
  let reportsLoadError = false;
  let safePointsLoadError = false;
  let selectedReportKey = null;
  let loadGeneration = 0;
  const ownership = new WeakMap();
  const sessionKey = (user) => user?.sub || user?.email || null;
  const ownsReport = (report, user = currentUser) => {
    const key = sessionKey(user);
    if (!key) return false;
    return ownership.has(report) ? ownership.get(report) === key : isReportOwner(report, user);
  };

  const ui = {
    menu: $('sidebar-menu'),
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
    stats: {
      reportes: $('stat-reportes'),
      seguros: $('stat-seguros')
    },
    status: $('status-indicator'),
    loginBtn: $('google-login-btn'),
    modal: $('report-modal'),
    inputLat: $('input-lat'),
    inputLon: $('input-lon')
  };

  const setSelectedReport = (report) => {
    selectedReportKey = getReportKey(report);
    ui.reportsList?.querySelectorAll('.rpt-card').forEach((card) => {
      const selected = card.dataset.reportKey === selectedReportKey;
      card.classList.toggle('is-selected', selected);
      card.classList.toggle('rpt-card--selected', selected);
      card.dataset.selected = String(selected);
      card.querySelector('.rpt-card-open')?.setAttribute('aria-pressed', String(selected));
    });
  };
  const locateReport = (report, _coordinates, { kind = 'report' } = {}) => {
    const coords = getReportCoordinates(report);
    if (!coords) { ViewModal.open(report, { kind }); return; }
    if (kind !== 'safe') setSelectedReport(report);
    if (window.innerWidth < 768) dashboardUI.collapsePanel();
    mapController.flyToLocation(coords.lat, coords.lon);
    mapController.getReportMarker(report, { kind })?.openPopup();
  };
  const showListState = (state) => {
    if (!ui.reportsList) return;
    if (state === 'loading') {
      ui.reportsList.innerHTML = Array.from({ length: 3 }, () =>
        '<div class="rpt-skeleton" aria-hidden="true"><span class="rpt-skeleton-photo"></span><span class="rpt-skeleton-copy"><span class="rpt-skeleton-line"></span><span class="rpt-skeleton-line"></span><span class="rpt-skeleton-line"></span></span></div>').join('');
      return;
    }
    const wrapper = document.createElement('div');
    wrapper.className = 'rpt-list-state';
    wrapper.innerHTML = icon(state === 'error' ? 'refresh' : 'search', 28);
    const title = document.createElement('strong');
    title.textContent = state === 'error' ? 'No pudimos cargar los reportes' : 'No hay reportes para mostrar';
    const message = document.createElement('p');
    message.textContent = state === 'error' ? 'Revisa tu conexión y vuelve a intentarlo.'
      : state.filterText || state.selectedCategories?.size ? 'Prueba otra búsqueda o cambia los filtros.' : 'Los reportes aparecerán aquí cuando estén disponibles.';
    // Filter state is kept in app state, not inferred from missing report fields.
    if (state === 'empty') message.textContent = 'Prueba otra búsqueda o cambia los filtros.';
    wrapper.append(title, message);
    if (state === 'error') {
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = 'Volver a intentar';
      retry.addEventListener('click', () => loadData());
      wrapper.append(retry);
    }
    ui.reportsList.replaceChildren(wrapper);
  };

  // Iniciar mapa
  mapController.init(CONFIG.DEFAULT_COORDS, CONFIG.DEFAULT_ZOOM);

  const setReportSelection = (active) => {
    isSelectionMode = active;
    dashboardUI.setSelectionMode(active);
    if ($('map')) $('map').style.cursor = active ? 'crosshair' : '';
    if (active) {
      dashboardUI.collapsePanel();
      setNotificationsOpen(false);
    }
  };

  const reportForm = initReportForm({
    getUser: () => SessionManager.getUser(),
    publish: ({ user, fields: rawForm, photo }) => {
      const createdToday = state.allReports.filter((report) =>
        ownsReport(report, user) && isCreatedToday(report)
      ).length;
      if (createdToday >= DAILY_REPORT_LIMIT) {
        throw new Error(`Hoy ya alcanzaste el límite de ${DAILY_REPORT_LIMIT} reportes. Puedes publicar de nuevo mañana.`);
      }

      const manualData = new FormData();
      const userId = user.sub || 'anon';
      const userEmail = user.email || '';

      manualData.append('user_id', userId);
      manualData.append('email', userEmail);
      manualData.append('description', rawForm.get('description'));
      manualData.append('category', rawForm.get('category'));
      manualData.append('phone', rawForm.get('phone'));
      manualData.append('security_question', rawForm.get('security_question'));
      manualData.append('security_answer', rawForm.get('security_answer'));
      manualData.append('latitude', rawForm.get('lat'));
      manualData.append('longitude', rawForm.get('lon'));
      manualData.append('status', rawForm.get('status') || 'LOST');
      manualData.append(
        'timestamp',
        Math.floor(Date.now() / 1000).toString()
      );
      if (photo) manualData.append('foto', photo);

      return api.post(CONFIG.ENDPOINTS.REPORTAR, manualData);
    },
    onPublished: () => setTimeout(loadData, 2000),
    onChangeLocation: () => {
      setReportSelection(true);
      showToast('Elige la ubicación del reporte en el mapa.', 'info');
    },
    notify: showToast
  });

  // The existing report form still receives the exact map coordinates.
  if (mapController.map && ui.btnAddReport && ui.modal) {
    mapController.map.on('click', (e) => {
      if (!isSelectionMode) return;
      setReportSelection(false);
      $('toast')?.classList.add('hidden');
      reportForm.open(e.latlng.lat, e.latlng.lng);
    });
  }

  // ----- BORRAR REPORTE -----
  const handleDeleteReport = async (reportId) => {
    const user = SessionManager.getUser();
    const report = state.allReports.find((item) => String(item.id) === String(reportId));
    if (!user || !report || !ownsReport(report, user)) {
      showToast('No tienes permiso para eliminar este reporte.', 'warning');
      return false;
    }
    if (
      !confirm(
        '⚠️ ¿Estás seguro de que quieres eliminar este reporte?\n\nEsta acción no se puede deshacer.'
      )
    )
      return false;
    try {
      state.allReports = state.allReports.filter((r) => r.id !== reportId);
      render();
      const userId = user?.sub || '';
      await api.delete(`${CONFIG.ENDPOINTS.REPORTES}/${reportId}`, {
        user_id: userId
      });
      showToast('Reporte eliminado correctamente.', 'success');

      setTimeout(loadData, 1000);
      return true;
    } catch (error) {
      console.error(error);
      showToast('Error al eliminar el reporte.', 'error');
      loadData();
      return false;
    }
  };

  ViewModal.init(api, {
    locate: locateReport,
    deleteReport: handleDeleteReport,
    isOwner: ownsReport
  });

  // ----- RENDER LISTA + MARCADORES -----
  const render = () => {
    mapController.beginMarkerSync();

    const filteredReports = state.allReports.filter((r) => {
      const text = getReportTitle(r).toLowerCase();
      const matchText = text.includes(state.filterText.toLowerCase());

      let matchCategory = true;
      if (state.selectedCategories.size > 0) {
        const rCat = normalizeCategory(r.category);
        matchCategory = state.selectedCategories.has(rCat);
      }

      let matchDistance = true;
      if (state.filterNearby && mapController.userLocation) {
        const { lat, lon } = getCoords(r);
        if (lat !== null && lon !== null) {
          const dist = getDistanceInMeters(
            mapController.userLocation.lat,
            mapController.userLocation.lon,
            lat,
            lon
          );
          matchDistance = dist <= NEARBY_RADIUS_METERS;
        } else matchDistance = false;
      }

      let matchMine = true;
      if (state.filterMine) matchMine = ownsReport(r, currentUser);

      return matchText && matchCategory && matchDistance && matchMine;
    });

    if (ui.reportsList) ui.reportsList.replaceChildren();
    if (!reportsHaveSnapshot && reportsLoading) showListState('loading');
    else if (!filteredReports.length) showListState(reportsLoadError ? 'error' : 'empty');

    filteredReports.forEach((report) => {
      const owner = ownsReport(report, currentUser);
      mapController.addMarker(report, 'REPORT', {
        isOwner: owner, imageUrl: getReportImage(report, api),
        onDelete: handleDeleteReport, onSelect: setSelectedReport
      });
      const coords = getReportCoordinates(report);
      const distance = coords && mapController.userLocation
        ? getDistanceInMeters(mapController.userLocation.lat, mapController.userLocation.lon, coords.lat, coords.lon)
        : undefined;
      if (ui.reportsList) ui.reportsList.append(createReportCard(report, {
        api, isOwner: owner, distanceMeters: distance,
        selected: selectedReportKey === getReportKey(report),
        onLocate: locateReport,
        onDetails: (item) => { setSelectedReport(item); ViewModal.open(item); },
        onDelete: handleDeleteReport
      }));
    });

    state.allSafePoints.forEach((s) =>
      mapController.addMarker(s, 'SAFE_POINT')
    );

    mapController.endMarkerSync();
    if (ui.stats.reportes) ui.stats.reportes.textContent = reportsHaveSnapshot ? filteredReports.length : '—';
    if (ui.stats.seguros) ui.stats.seguros.textContent = safePointsHaveSnapshot ? state.allSafePoints.length : '—';
    const feedback = $('reports-feedback');
    if (feedback) feedback.textContent = reportsLoading ? 'Actualizando reportes…'
      : reportsLoadError ? (reportsHaveSnapshot ? 'No pudimos actualizar. Se muestran los últimos datos cargados.' : 'No pudimos obtener los reportes.')
      : safePointsLoadError ? 'Reportes actualizados. No pudimos actualizar los puntos seguros.'
      : filteredReports.length ? 'Selecciona un reporte para localizarlo o consultar sus detalles.' : 'Sin resultados con los filtros actuales.';
    ui.reportsList?.setAttribute('aria-busy', String(reportsLoading));
    if ($('profile-report-count')) $('profile-report-count').textContent =
      state.allReports.filter((report) => ownsReport(report, currentUser)).length;
  };

  // -------- BADGE DE NOTIFICACIONES (PUNTO ROJO) --------
  const refreshNotificationBadge = () => {
    if (!ui.badgeNotifications) return;
    if (!mapController.userLocation) {
      ui.badgeNotifications.classList.add('hidden');
      return;
    }
    const hasNearby = getNearbyReports(
      state.allReports,
      mapController.userLocation,
      NEARBY_RADIUS_METERS
    ).length > 0;

    ui.badgeNotifications.classList.toggle('hidden', !hasNearby);
  };

  // -------- CARGA DE DATOS --------
  const loadData = async () => {
    const requestGeneration = ++loadGeneration;
    try {
      if (!mapController.map) return;
      if (ui.status) ui.status.innerHTML = '<span class="status-dot"></span>Actualizando…';
      connectionState = 'loading';
      reportsLoading = true;
      dashboardUI.setConnection('loading');
      ui.btnRefresh?.setAttribute('aria-busy', 'true');
      render();
      const results = await api.fetchData(currentUser);
      if (requestGeneration !== loadGeneration) return;
      const [reportsRes, safesRes, configRes] = results;
      reportsLoadError = reportsRes.status !== 'fulfilled' || !Array.isArray(reportsRes.value);
      safePointsLoadError = safesRes.status !== 'fulfilled' || !Array.isArray(safesRes.value);
      if (configRes.status === 'fulfilled') mapController.setColors(configRes.value?.colores_mapa);
      if (!reportsLoadError) {
        state.allReports = uniqueReports(reportsRes.value).map((rawReport) => {
          const report = {
            ...rawReport,
            security_answer: undefined,
            email: maskPublicEmail(rawReport.email)
          };
          ownership.set(report, isReportOwner(rawReport, currentUser) ? sessionKey(currentUser) : null);
          return report;
        });
        reportsHaveSnapshot = true;
      }
      if (!safePointsLoadError) {
        state.allSafePoints = uniqueReports(safesRes.value);
        safePointsHaveSnapshot = true;
      }
      reportsLoading = false;
      const hasErrors = reportsLoadError || safePointsLoadError;
      connectionState = hasErrors ? 'offline' : 'online';
      dashboardUI.setConnection(connectionState);
      render();
      refreshNotificationBadge();
      if (ui.status) ui.status.innerHTML = hasErrors
        ? `<span class="status-dot"></span>${reportsLoadError && safePointsLoadError ? 'Sin conexión' : 'Conexión parcial'}`
        : '<span class="status-dot"></span>En línea';
    } catch (error) {
      if (requestGeneration !== loadGeneration) return;
      console.error(error);
      reportsLoading = false;
      reportsLoadError = true;
      connectionState = 'offline';
      dashboardUI.setConnection('offline');
      render();
      if (ui.status) ui.status.innerHTML = '<span class="status-dot"></span>Sin conexión';
    } finally {
      if (requestGeneration === loadGeneration) {
        reportsLoading = false;
        ui.reportsList?.setAttribute('aria-busy', 'false');
        ui.btnRefresh?.setAttribute('aria-busy', 'false');
      }
    }
  };

  // -------- BOTÓN NUEVO REPORTE --------
  if (ui.btnAddReport) {
    ui.btnAddReport.onclick = () => {
      if (!currentUser) {
        showToast(
          'Acceso restringido. Inicia sesión para poder reportar un objeto perdido.',
          'warning'
        );
        return;
      }
      if (reportForm.isSubmitting()) {
        showToast('Tu reporte sigue publicándose. Espera a que termine.', 'info');
        return;
      }
      setReportSelection(!isSelectionMode);
      if (isSelectionMode)
        showToast('Haz clic en el mapa donde quieras colocar el reporte.', 'info');
    };
  }

  ui.btnRefresh && (ui.btnRefresh.onclick = loadData);
  $('btn-zoom-in')?.addEventListener('click', () => mapController.map?.zoomIn());
  $('btn-zoom-out')?.addEventListener('click', () => mapController.map?.zoomOut());
  ui.btnLogout && (ui.btnLogout.onclick = SessionManager.logout);

  const updateLocation = (pos, center = true) => {
    mapController.updateUserLocation(pos.coords.latitude, pos.coords.longitude);
    if (center) mapController.flyToUser();
    if (state.filterNearby) render();
    refreshNotificationBadge();
    if (ui.notificationsMenu && !ui.notificationsMenu.hidden) populateNotifications();
  };
  const requestLocation = () => {
    if (!navigator.geolocation) {
      showToast('Este navegador no ofrece ubicación.', 'warning');
      return;
    }
    ui.btnGps?.setAttribute('aria-busy', 'true');
    navigator.geolocation.getCurrentPosition(
      (pos) => { updateLocation(pos); ui.btnGps?.setAttribute('aria-busy', 'false'); },
      () => {
        ui.btnGps?.setAttribute('aria-busy', 'false');
        showToast('No pudimos obtener tu ubicación. Revisa el permiso del navegador.', 'warning');
      },
      { timeout: 10000 }
    );
  };
  if (ui.btnGps) ui.btnGps.onclick = requestLocation;

  ui.searchInput &&
    ui.searchInput.addEventListener('input', (e) => {
      state.filterText = e.target.value;
      render();
    });

  // FILTROS
  if (ui.inputFilterNearby) {
    ui.inputFilterNearby.addEventListener('change', (e) => {
      if (e.target.checked && !mapController.userLocation) {
        showToast(
          'Necesitamos tu ubicación para filtrar por cercanía. Presiona el botón 📍',
          'warning'
        );
        e.target.checked = false;
        return;
      }
      state.filterNearby = e.target.checked;
      render();
    });
  }

  ui.inputFilterMine &&
    ui.inputFilterMine.addEventListener('change', (e) => {
      state.filterMine = e.target.checked;
      render();
    });

  ui.checkboxesCategory.forEach((chk) => {
    chk.addEventListener('change', (e) => {
      if (e.target.checked) state.selectedCategories.add(e.target.value);
      else state.selectedCategories.delete(e.target.value);
      render();
    });
  });

  // ------- PANEL LATERAL DERECHO (NOTIFICACIONES) -------
  const populateNotifications = () => {
    if (!ui.notificationsList) return;

    if (!mapController.userLocation) {
      ui.notificationsList.innerHTML =
        '<p class="list-message">Activa «Ubicarme» para ver los reportes de tu zona.</p>';
      return;
    }

    const nearbyReports = getNearbyReports(
      state.allReports,
      mapController.userLocation,
      NEARBY_RADIUS_METERS
    );

    if (nearbyReports.length === 0) {
      ui.notificationsList.innerHTML =
        '<p class="list-message">No hay reportes a menos de 2.5 km de tu ubicación.</p>';
      return;
    }

    ui.notificationsList.innerHTML = '';
    nearbyReports.forEach((r) => {
      const { lat, lon } = getCoords(r);
      const dist = getDistanceInMeters(
        mapController.userLocation.lat,
        mapController.userLocation.lon,
        lat,
        lon
      );
      const item = document.createElement('button');
      item.className = 'notification-item';
      item.innerHTML = '<span aria-hidden="true">◇</span><span class="flex-1 min-w-0">' +
        '<strong class="truncate">' + escapeHtml(getReportTitle(r)) + '</strong>' +
        '<small>' + Math.round(dist) + ' m de ti</small></span><span aria-hidden="true">›</span>';
      item.onclick = () => {
        setNotificationsOpen(false);
        ui.badgeNotifications?.classList.add('hidden');
        if (window.innerWidth < 768) dashboardUI.collapsePanel();
        mapController.flyToLocation(lat, lon);
        setTimeout(() => mapController.openMarkerPopup(r.id), 300);
      };
      ui.notificationsList.appendChild(item);
    });
  };

  let notificationReturnFocus = null;
  const setNotificationsOpen = (open) => {
    if (!ui.notificationsMenu || open === !ui.notificationsMenu.hidden) return;
    if (open) notificationReturnFocus = document.activeElement;
    ui.notificationsMenu.hidden = !open;
    ui.notificationsMenu.inert = !open;
    if ($('notifications-backdrop')) $('notifications-backdrop').hidden = !open;
    ui.btnNotificationsSidebar?.setAttribute('aria-expanded', String(open));
    document.querySelectorAll('.lostnet-dashboard > :not(#notifications-menu):not(#notifications-backdrop)')
      .forEach((element) => { element.inert = open; });
    if (open) {
      populateNotifications();
      ui.badgeNotifications?.classList.add('hidden');
      ui.btnCloseNotifications?.focus();
    } else notificationReturnFocus?.focus();
  };
  ui.btnNotificationsSidebar?.addEventListener('click', () => setNotificationsOpen(true));
  $('btn-profile-alerts')?.addEventListener('click', () => setNotificationsOpen(true));
  ui.btnCloseNotifications?.addEventListener('click', () => setNotificationsOpen(false));
  $('notifications-backdrop')?.addEventListener('click', () => setNotificationsOpen(false));

  // Preserve the forms while making all dialogs keyboard operable.
  const dialogs = [ui.modal, $('view-modal')].filter(Boolean);
  dialogs.forEach((modal) => {
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', modal === ui.modal ? 'Nuevo reporte' : 'Detalle del reporte');
    let wasOpen = false;
    let returnFocus;
    new MutationObserver(() => {
      const open = !modal.classList.contains('hidden');
      if (open === wasOpen) return;
      wasOpen = open;
      const root = document.querySelector('.lostnet-dashboard');
      if (root) root.inert = dialogs.some((dialog) => !dialog.classList.contains('hidden'));
      if (open) {
        returnFocus = document.activeElement;
        modal.querySelector('button, input, select, textarea, a[href]')?.focus();
      } else if (returnFocus?.isConnected) returnFocus.focus();
    }).observe(modal, { attributes: true, attributeFilter: ['class'] });
  });
  document.addEventListener('keydown', (event) => {
    const activeDialog = [...dialogs].reverse().find((dialog) => !dialog.classList.contains('hidden'))
      || (ui.notificationsMenu && !ui.notificationsMenu.hidden ? ui.notificationsMenu : null);
    if (event.key === 'Escape') {
      if (activeDialog === ui.notificationsMenu) setNotificationsOpen(false);
      else if (activeDialog) activeDialog.classList.add('hidden');
      else if (isSelectionMode) setReportSelection(false);
      else return;
      event.preventDefault();
    }
    if (event.key !== 'Tab' || !activeDialog) return;
    const focusable = [...activeDialog.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')]
      .filter((element) => !element.disabled && !element.hidden && element.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first?.focus();
    }
  });

  // ------- GOOGLE LOGIN -------
  if (window.google && ui.loginBtn) {
    google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: (res) => {
        SessionManager.saveUser(decodeJwtResponse(res.credential));
        window.location.href = CONFIG.ROUTES.DASHBOARD;
      }
    });
    google.accounts.id.renderButton(ui.loginBtn, {
      theme: 'outline',
      size: 'large',
      width: '250',
      shape: 'pill'
    });
  }

  // ------- ARRANQUE INICIAL -------
  if (mapController.map) {
    await loadData();
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition(
      (pos) => updateLocation(pos),
      () => console.info('Ubicación no disponible; el mapa sigue activo.'),
      { timeout: 10000 }
    );
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
