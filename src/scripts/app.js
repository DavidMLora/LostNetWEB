import L from 'leaflet';
// Asegúrate de que estas rutas sean resueltas correctamente por Vite/Astro
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

// Configuración de iconos por defecto (evita rutas 404)
L.Icon.Default.mergeOptions({
  iconUrl,
  iconRetinaUrl,
  shadowUrl
});

const CONFIG = {
  // Usa variables de entorno si están disponibles
  API_BASE_URL: import.meta.env.PUBLIC_API_URL || 'http://10.155.13.137:5000',
  GOOGLE_CLIENT_ID: 'TU_CLIENT_ID_DE_GOOGLE.apps.googleusercontent.com',
  DEFAULT_COORDS: [21.88, -102.29],
  DEFAULT_ZOOM: 13,
  GPS_ZOOM: 16,
  ENDPOINTS: {
    REPORTES: '/reportes',
    PUNTOS_SEGUROS: '/puntos-seguros',
    ALERTAS: '/mis-alertas',
    CONFIG: '/config'
  },
  // Rutas de tu aplicación (Así es como Astro maneja las "Activity")
  ROUTES: {
    LOGIN: '/',        // index.astro
    DASHBOARD: '/monitor' // monitor.astro (antes era index)
  }
};

// --- GESTIÓN DE SESIÓN (NUEVO) ---
const SessionManager = {
  saveUser: (user) => {
    localStorage.setItem('lostnet_user', JSON.stringify(user));
  },
  getUser: () => {
    const data = localStorage.getItem('lostnet_user');
    return data ? JSON.parse(data) : null;
  },
  logout: () => {
    localStorage.removeItem('lostnet_user');
    window.location.href = CONFIG.ROUTES.LOGIN;
  }
};

// --- UTILIDAD: Decodificar JWT ---
function decodeJwtResponse(token) {
  let base64Url = token.split('.')[1];
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  let jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
  return JSON.parse(jsonPayload);
}

class ApiService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async get(endpoint, params = {}) {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    Object.keys(params).forEach(k => {
      if (params[k] !== null && params[k] !== undefined) url.searchParams.append(k, params[k]);
    });

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  fetchReportes() {
    return this.get(CONFIG.ENDPOINTS.REPORTES);
  }
  fetchPuntosSeguros() {
    return this.get(CONFIG.ENDPOINTS.PUNTOS_SEGUROS);
  }
  fetchAlertas(email, coords = null) {
    if (!email) return Promise.resolve([]); 
    const params = { email };
    if (coords) {
      params.lat = coords.lat;
      params.lon = coords.lon;
    }
    return this.get(CONFIG.ENDPOINTS.ALERTAS, params);
  }

  resolveImageUrl(path) {
    if (!path) return null;
    return path.startsWith('http') ? path : `${this.baseUrl}${path}`;
  }
}

class MapController {
  constructor(elementId) {
    this.elementId = elementId;
    this.map = null;
    this.markers = L.layerGroup();
  }

  init(coords, zoom) {
    if (this.map) return;
    const mapElement = document.getElementById(this.elementId);
    
    // Si no existe el elemento mapa (ej. estamos en el login), no hacemos nada
    if (!mapElement) return;

    this.map = L.map(this.elementId).setView(coords, zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© LostNet Contributors'
    }).addTo(this.map);
    this.markers.addTo(this.map);
  }

  clearMarkers() {
    if(this.markers) this.markers.clearLayers();
  }

  addReportMarker(report, isOwner, imageUrl) {
    if (report.lat == null || report.lon == null) return;
    const color = isOwner ? "#2563EB" : "#EF4444";
    const safeDesc = report.descripcion ? report.descripcion.replace(/</g, "&lt;") : "Sin descripción";

    const popupContent = `
    <div class="min-w-[220px] font-sans">
      <h3 class="font-bold text-lg mb-2" style="color:${color}">
        ${isOwner ? "Tu reporte" : "Reporte"}
      </h3>
      <p class="text-sm mb-2">${safeDesc}</p>
      ${imageUrl ? `<img src="${imageUrl}" class="w-full h-28 object-cover rounded mb-2" onerror="this.style.display='none'">` : ""}
      <p class="text-xs text-gray-600">${report.fecha || "Sin fecha"}</p>
    </div>`;

    const marker = L.marker([report.lat, report.lon], {
      icon: L.divIcon({
        className: "custom-marker",
        html: `<div style="width:14px;height:14px;background:${color};border-radius:99px;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>`
      })
    });
    marker.bindPopup(popupContent);
    marker.addTo(this.markers);
  }
}

// --- LÓGICA PRINCIPAL ---

const initApp = async () => {
  console.log('Iniciando LostNet Client...');
  
  // 1. CHEQUEO DE SEGURIDAD (Auth Guard)
  const currentUser = SessionManager.getUser();
  const currentPath = window.location.pathname;
  
  // Si estamos en dashboard (monitor) y NO hay usuario -> Al Login
  if (currentPath.includes(CONFIG.ROUTES.DASHBOARD) && !currentUser) {
    window.location.href = CONFIG.ROUTES.LOGIN;
    return; // Detener ejecución
  }

  // Si estamos en Login (raíz) y SÍ hay usuario -> Al Dashboard
  if (currentPath === CONFIG.ROUTES.LOGIN && currentUser) {
    window.location.href = CONFIG.ROUTES.DASHBOARD;
    return; // Detener ejecución
  }

  // 2. Instancias
  const api = new ApiService(CONFIG.API_BASE_URL);
  const mapController = new MapController('map');
  
  // Referencias DOM
  const btnRefresh = document.getElementById('btn-refresh');
  const btnGps = document.getElementById('btn-gps');
  const btnLogout = document.getElementById('btn-logout'); // Nuevo botón
  const statReportes = document.getElementById('stat-reportes');
  const statSeguros = document.getElementById('stat-seguros');
  const statusIndicator = document.getElementById('status-indicator');
  const loginContainer = document.getElementById('google-login-btn');

  // Inicializar Mapa (Solo si existe el div, es decir, solo en /monitor)
  mapController.init(CONFIG.DEFAULT_COORDS, CONFIG.DEFAULT_ZOOM);

  // Mostrar nombre de usuario si existe
  if (currentUser) {
    const headerTitle = document.querySelector('header h1');
    if(headerTitle) {
      headerTitle.innerHTML = `LostNet <span class="text-blue-600 text-xs block">Hola, ${currentUser.given_name}</span>`;
    }
  }

  // --- FUNCIÓN DE CARGA DE DATOS ---
  const loadData = async () => {
    // Si no hay mapa (estamos en login), no cargamos datos geográficos
    if (!mapController.map) return;

    try {
      if (statusIndicator) statusIndicator.innerHTML = '<span class="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span> Cargando...';
      
      mapController.clearMarkers();

      const [reportesResult, segurosResult, alertasResult] = await Promise.allSettled([
        api.fetchReportes(),
        api.fetchPuntosSeguros(),
        currentUser ? api.fetchAlertas(currentUser.email) : Promise.resolve([])
      ]);

      const reportes = reportesResult.status === 'fulfilled' ? reportesResult.value : [];
      const seguros = segurosResult.status === 'fulfilled' ? segurosResult.value : [];
      const alertas = alertasResult.status === 'fulfilled' ? alertasResult.value : [];

      // Pintar Reportes
      if (Array.isArray(reportes)) {
        reportes.forEach(r => {
          const isOwner = currentUser && r.user_id === currentUser.email; // Ajustar según tu ID
          const img = api.resolveImageUrl(r.imagen_url);
          mapController.addReportMarker(r, isOwner, img);
        });
        if (statReportes) statReportes.textContent = reportes.length;
      }

      if (statSeguros) statSeguros.textContent = seguros.length;

      // Actualizar UI de alertas
      const alertsContainer = document.getElementById('alerts-container');
      if (alertsContainer) {
        if (!alertas.length) {
          alertsContainer.innerHTML = '<p class="text-xs text-gray-400 italic text-center py-4">Sin novedades</p>';
        } else {
          alertsContainer.innerHTML = alertas.map(a => `
            <div class="bg-red-50 p-2 rounded border border-red-100 text-xs mb-2">
              <strong class="text-red-700 block">${a.title}</strong>
              <span class="text-gray-600">${a.message}</span>
            </div>
          `).join('');
        }
      }

      if (statusIndicator) statusIndicator.innerHTML = '<span class="w-2 h-2 rounded-full bg-green-500"></span> Conectado';

    } catch (error) {
      console.error("Error cargando datos:", error);
      if (statusIndicator) statusIndicator.innerHTML = '<span class="w-2 h-2 rounded-full bg-red-500"></span> Error';
    }
  };

  // --- INTEGRACIÓN GOOGLE AUTH ---
  const handleCredentialResponse = (response) => {
    const responsePayload = decodeJwtResponse(response.credential);

    console.log("Login exitoso: " + responsePayload.email);

    // 1. Guardar sesión
    SessionManager.saveUser(responsePayload);

    // 2. Redirigir al dashboard
    window.location.href = CONFIG.ROUTES.DASHBOARD;
  };

  // Inicializar botón de Google (Solo si estamos en la página de Login o donde esté el container)
  if (window.google && loginContainer) {
    google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse
    });

    google.accounts.id.renderButton(
      loginContainer,
      { theme: "outline", size: "large", width: "250", shape: "pill" } 
    );
    
    // Opcional: One Tap
    // google.accounts.id.prompt(); 
  }

  // --- EVENT LISTENERS ---
  if (btnRefresh) btnRefresh.addEventListener('click', loadData);
  if (btnLogout) btnLogout.addEventListener('click', SessionManager.logout); // Logout manual

  if (btnGps) {
    btnGps.addEventListener('click', () => {
      if (!navigator.geolocation) return alert('Geolocalización no soportada');
      btnGps.classList.add('opacity-50', 'cursor-wait');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          if (mapController.map) {
            mapController.map.flyTo([latitude, longitude], CONFIG.GPS_ZOOM);
            L.circleMarker([latitude, longitude], { radius: 8, color: '#3B82F6', fillOpacity: 0.8 }).addTo(mapController.map);
          }
          btnGps.classList.remove('opacity-50', 'cursor-wait');
        },
        () => {
          alert('Error de ubicación');
          btnGps.classList.remove('opacity-50', 'cursor-wait');
        },
        { enableHighAccuracy: true }
      );
    });
  }

  // Carga inicial solo si estamos en el dashboard
  if (mapController.map) {
    await loadData();
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}