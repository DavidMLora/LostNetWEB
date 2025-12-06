/**
 * LOSTNET CLIENT APP
 * Lógica principal: Mapa, Rutas, Búsqueda, Filtros, Autenticación y NUEVO REPORTE.
 * Adaptado para UI con Sidebar Scrollable.
 */

// --- 1. IMPORTS & CONFIG ---
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine'; 
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';

// Fix para imágenes de Leaflet en Vite/Astro
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

const CONFIG = {
  // TU SERVIDOR LOCAL
  API_BASE_URL: import.meta.env.PUBLIC_API_URL || 'http://10.155.13.137:5000',
  GOOGLE_CLIENT_ID: 'TU_CLIENT_ID_DE_GOOGLE.apps.googleusercontent.com', 
  DEFAULT_COORDS: [21.88, -102.29], // Aguascalientes Centro
  DEFAULT_ZOOM: 13,
  GPS_ZOOM: 16,
  ROUTES: {
    LOGIN: '/',
    DASHBOARD: '/monitor'
  },
  ENDPOINTS: {
    REPORTES: '/reportes',
    REPORTAR: '/reportar',
    PUNTOS_SEGUROS: '/puntos-seguros',
    ALERTAS: '/mis-alertas',
    CONFIG: '/config',
    CONTACTO: '/contacto'
  },
  VALID_CATEGORIES: ["Electrónica", "Ropa", "Documentos", "Otros"],
  COLORS: {
    propio: "#2563EB",
    ajeno: "#EF4444",
    seguro: "#10B981"
  }
};

// --- 2. UTILS ---

function decodeJwtResponse(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => 
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

// Inyecta estilos para Routing Machine
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
      
      /* Posición fija en ESQUINA SUPERIOR DERECHA */
      position: fixed !important; 
      right: 20px !important;  
      top: 80px !important;    
      
      left: auto !important;
      bottom: auto !important;

      max-width: 320px;
      color: #1f2937;
      z-index: 9999 !important; 
    }
    .leaflet-routing-container h2 { display: none; }
    .leaflet-routing-alt table { margin-bottom: 5px; width: 100%; }
    .leaflet-routing-alt tr:hover { background-color: rgba(59, 130, 246, 0.1) !important; cursor: pointer; }
    .leaflet-routing-alt { max-height: 300px; overflow-y: auto; scrollbar-width: thin; padding-bottom: 5px; } 
    .leaflet-routing-alt:not(:first-of-type) { display: none !important; }
    
    @media print { .routing-container-custom { display: none; } }
  `;
  document.head.appendChild(style);
};

const ImageModal = {
  init() {
    if (document.getElementById('image-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'image-modal';
    modal.className = 'fixed inset-0 z-[9999] bg-black/95 hidden flex items-center justify-center p-4 cursor-pointer transition-opacity duration-300';
    modal.innerHTML = `
      <div class="relative w-full h-full flex items-center justify-center">
        <img id="modal-img" src="" class="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />
        <button class="absolute top-4 right-4 text-white bg-white/10 rounded-full w-12 h-12 flex items-center justify-center hover:bg-white/20 transition-all text-2xl font-bold">&times;</button>
        <p class="absolute bottom-8 text-white/70 text-sm bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">Toca para cerrar</p>
      </div>`;
    modal.onclick = () => modal.classList.add('hidden');
    document.body.appendChild(modal);
  },
  open(src) {
    const modal = document.getElementById('image-modal');
    const img = document.getElementById('modal-img');
    if (modal && img) { img.src = src; modal.classList.remove('hidden'); }
  }
};

// --- 3. SESSION MANAGER ---

const SessionManager = {
  saveUser: (user) => localStorage.setItem('lostnet_user', JSON.stringify(user)),
  getUser: () => {
    const data = localStorage.getItem('lostnet_user');
    return data ? JSON.parse(data) : null;
  },
  logout: () => {
    localStorage.removeItem('lostnet_user');
    window.location.href = CONFIG.ROUTES.LOGIN;
  },
  guard: () => {
    const user = SessionManager.getUser();
    const path = window.location.pathname;
    const isDashboard = path.includes(CONFIG.ROUTES.DASHBOARD);
    const isLogin = path === CONFIG.ROUTES.LOGIN || path === '/';

    if (isDashboard && !user) window.location.href = CONFIG.ROUTES.LOGIN;
    if (isLogin && user) window.location.href = CONFIG.ROUTES.DASHBOARD;
    return user;
  }
};

// --- 4. SERVICES ---

class ApiService {
  constructor() { this.baseUrl = CONFIG.API_BASE_URL; }

  async get(endpoint, params = {}) {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    Object.keys(params).forEach(k => { if (params[k] != null) url.searchParams.append(k, params[k]); });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return await res.json();
  }

  async post(endpoint, body) {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    const options = { method: 'POST', body: body };
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return await res.json();
  }

  fetchData(currentUser) {
    const promises = [
      this.get(CONFIG.ENDPOINTS.REPORTES),
      this.get(CONFIG.ENDPOINTS.PUNTOS_SEGUROS),
      this.get(CONFIG.ENDPOINTS.CONFIG).catch(() => null)
    ];
    if (currentUser) {
      promises.push(this.get(CONFIG.ENDPOINTS.ALERTAS, { email: currentUser.email }));
    }
    return Promise.allSettled(promises);
  }

  fetchContacto(ownerId) { return this.get(CONFIG.ENDPOINTS.CONTACTO, { user_id: ownerId }); }
  resolveUrl(path) { return path && !path.startsWith('http') ? `${this.baseUrl}${path}` : path; }
}

class MapController {
  constructor(elementId) {
    this.elementId = elementId;
    this.map = null;
    this.markers = L.layerGroup();
    this.userLocation = null; 
    this.routingControl = null; 
    this.colors = { ...CONFIG.COLORS };
  }

  init(coords, zoom) {
    if (this.map || !document.getElementById(this.elementId)) return;
    this.map = L.map(this.elementId, { zoomControl: false }).setView(coords, zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© LostNet' }).addTo(this.map);
    this.markers.addTo(this.map);
  }

  setColors(serverColors) {
    if (serverColors) {
      this.colors = {
        propio: serverColors.pin_propio || this.colors.propio,
        ajeno: serverColors.pin_ajeno || this.colors.ajeno,
        seguro: serverColors.pin_seguro || this.colors.seguro
      };
    }
  }

  updateUserLocation(lat, lon) {
    this.userLocation = { lat, lon };
    if (this.userMarker) this.map.removeLayer(this.userMarker);
    if (this.userAccuracy) this.map.removeLayer(this.userAccuracy);
    this.userAccuracy = L.circle([lat, lon], { radius: 20, color: '#3B82F6', fillOpacity: 0.2 }).addTo(this.map);
    this.userMarker = L.circleMarker([lat, lon], { radius: 6, color: '#3B82F6', fillOpacity: 1, stroke: false }).addTo(this.map);
  }

  flyToUser() {
    if (this.userLocation) {
      this.map.flyTo([this.userLocation.lat, this.userLocation.lon], CONFIG.GPS_ZOOM);
    }
  }

  flyToLocation(lat, lon) {
    if (this.map) {
      this.map.flyTo([lat, lon], CONFIG.GPS_ZOOM, { animate: true, duration: 1.0 });
    }
  }

  clearRoute() {
    if (this.routingControl) {
      this.map.removeControl(this.routingControl);
      this.routingControl = null;
    }
    document.querySelectorAll('.routing-container-custom').forEach(c => c.remove());
  }

  drawRouteTo(destLat, destLon, profile = 'driving') {
    if (!this.userLocation) {
      alert("⚠️ Necesitamos tu ubicación primero.\nPresiona el botón de 'Ubicarme'.");
      return;
    }
    this.clearRoute();
    const isWalking = profile === 'walking';
    const serviceUrl = isWalking ? 'https://routing.openstreetmap.de/routed-foot/route/v1' : 'https://routing.openstreetmap.de/routed-car/route/v1';
    const lineColor = isWalking ? '#10B981' : '#6366F1'; 
    const lineStyle = isWalking ? [{ color: lineColor, opacity: 0.8, weight: 5, dashArray: '10, 10' }] : [{ color: lineColor, opacity: 0.8, weight: 5 }];

    this.routingControl = L.Routing.control({
      waypoints: [L.latLng(this.userLocation.lat, this.userLocation.lon), L.latLng(destLat, destLon)],
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
      createMarker: function(i, wp, nWps) {
        const isStart = i === 0;
        const isEnd = i === nWps - 1;
        if (!isStart && !isEnd) return null;
        return L.marker(wp.latLng, { draggable: false, icon: L.divIcon({ className: 'route-marker', html: `<div style="width: 12px; height: 12px; background: ${isStart ? '#3B82F6' : '#8B5CF6'}; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>` }) });
      }
    }).addTo(this.map);
  }

  clear() {
    this.markers.clearLayers();
    this.clearRoute();
  }

  _generatePopupButtons(id, isOwner, hasLocation) {
    const btnContactId = `btn-contact-${id}`;
    const btnCarId = `btn-car-${id}`;
    const btnWalkId = `btn-walk-${id}`;
    let html = '<div class="flex gap-2 mt-2">';
    if (hasLocation) {
      html += `<button id="${btnCarId}" class="flex-1 bg-white border border-gray-300 hover:bg-blue-50 text-blue-700 text-xs font-bold py-1.5 px-1 rounded flex items-center justify-center gap-1" title="Ruta en Auto">🚗</button>
               <button id="${btnWalkId}" class="flex-1 bg-white border border-gray-300 hover:bg-green-50 text-green-700 text-xs font-bold py-1.5 px-1 rounded flex items-center justify-center gap-1" title="Ruta a Pie">🚶</button>`;
    }
    if (!isOwner) {
      html += `<button id="${btnContactId}" class="flex-[2] bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1.5 px-2 rounded flex items-center justify-center gap-1">📞 Contactar</button>`;
    }
    html += '</div>';
    return { html, btnContactId, btnCarId, btnWalkId };
  }

  addMarker(data, type, options = {}) {
    const { lat, lon } = data;
    if (lat == null || lon == null) return;

    let color, title, iconClass, iconHtml;
    const isSafePoint = type === 'SAFE_POINT';
    const isOwner = options.isOwner;

    if (isSafePoint) {
      color = this.colors.seguro;
      title = "Punto Seguro";
      iconClass = "safe-point-marker";
      iconHtml = `<div style="width:18px;height:18px;background:${color};border-radius:4px;transform:rotate(45deg);border:2px solid white;box-shadow:0 0 5px rgba(0,255,0,0.5);"></div>`;
    } else {
      color = isOwner ? this.colors.propio : this.colors.ajeno;
      title = isOwner ? "Tu reporte" : "Objeto Perdido";
      iconClass = "custom-marker";
      iconHtml = `<div style="width:16px;height:16px;background:${color};border-radius:50%;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>`;
    }

    const uniqueId = Math.random().toString(36).substr(2, 9);
    const imgId = `img-${uniqueId}`;
    const buttons = this._generatePopupButtons(uniqueId, isOwner, true);
    
    let categoryBadge = '';
    if (!isSafePoint && data.category) {
        const cleanCat = CONFIG.VALID_CATEGORIES.includes(data.category) ? data.category : "Otros";
        categoryBadge = `<span class="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200 ml-auto">${cleanCat}</span>`;
    }

    const popupContent = `
      <div class="min-w-[220px] font-sans">
        <div class="flex items-center gap-2 mb-1">
            <h3 class="font-bold text-base" style="color:${color}">${title}</h3>
            ${categoryBadge}
        </div>
        ${isSafePoint ? 
          `<p class="font-semibold text-gray-800 text-sm">${data.nombre}</p><p class="text-xs text-gray-500">${data.horario || ''}</p>` : 
          `<p class="text-sm text-gray-800 mb-2">${(data.desc_short || data.descripcion || '').replace(/</g, "&lt;")}</p>`
        }
        ${options.imageUrl ? `<div class="relative group cursor-zoom-in mt-2"><img id="${imgId}" src="${options.imageUrl}" class="w-full h-32 object-cover rounded border border-gray-100 hover:brightness-90 transition-all"></div>` : ''}
        ${buttons.html}
      </div>`;

    const marker = L.marker([lat, lon], { icon: L.divIcon({ className: iconClass, html: iconHtml }) });
    marker.bindPopup(popupContent);
    marker.addTo(this.markers);

    marker.on('popupopen', () => {
      this.clearRoute(); 
      const img = document.getElementById(imgId); if (img) img.onclick = () => ImageModal.open(options.imageUrl);
      const btnCar = document.getElementById(buttons.btnCarId); if (btnCar) btnCar.onclick = () => this.drawRouteTo(lat, lon, 'driving');
      const btnWalk = document.getElementById(buttons.btnWalkId); if (btnWalk) btnWalk.onclick = () => this.drawRouteTo(lat, lon, 'walking');
      const btnContact = document.getElementById(buttons.btnContactId); if (btnContact && options.onContact) btnContact.onclick = () => options.onContact(data.user_id);
    });
    
    return marker;
  }
}

// --- 5. CORE (Main) ---

const initApp = async () => {
  console.log('🚀 LostNet Client Starting...');
  ImageModal.init();
  injectCustomStyles();

  const currentUser = SessionManager.guard();
  if (!currentUser && window.location.pathname.includes(CONFIG.ROUTES.DASHBOARD)) return;

  const api = new ApiService();
  const mapController = new MapController('map');

  const state = { allReports: [], allSafePoints: [], filterText: '', filterCategory: 'all' };
  
  // Estado para el modo de selección de mapa
  let isSelectionMode = false;
  let originalBtnContent = '';

  // UI References
  const ui = {
    // REFERENCIAS NUEVAS PARA EL MENÚ LATERAL Y SCROLL
    menu: document.getElementById('sidebar-menu'),
    btnMenu: document.getElementById('btn-menu-toggle'),
    btnCloseMenu: document.getElementById('btn-close-menu'),
    
    // Referencias existentes
    btnRefresh: document.getElementById('btn-refresh'),
    btnGps: document.getElementById('btn-gps'),
    btnAddReport: document.getElementById('btn-add-report'), 
    btnLogout: document.getElementById('btn-logout'),
    searchInput: document.getElementById('search-input'),
    categoryFilter: document.getElementById('category-filter'),
    reportsList: document.getElementById('reports-list'),
    stats: { reportes: document.getElementById('stat-reportes'), seguros: document.getElementById('stat-seguros') },
    status: document.getElementById('status-indicator'),
    loginBtn: document.getElementById('google-login-btn'),
    headerTitle: document.querySelector('header h1'),
    modal: document.getElementById('report-modal'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    formReport: document.getElementById('form-report'),
    inputPhoto: document.getElementById('input-photo'),
    previewImg: document.getElementById('preview-img'),
    previewContainer: document.getElementById('preview-container'),
    uploadPlaceholder: document.getElementById('upload-placeholder'),
    inputLat: document.getElementById('input-lat'),
    inputLon: document.getElementById('input-lon')
  };

  mapController.init(CONFIG.DEFAULT_COORDS, CONFIG.DEFAULT_ZOOM);
  
  // --- CLICK EN EL MAPA PARA SELECCIONAR ---
  if (mapController.map) {
      mapController.map.on('click', (e) => {
          if (!isSelectionMode) return;
          
          const { lat, lng } = e.latlng;
          
          // 1. Llenar inputs
          ui.inputLat.value = lat;
          ui.inputLon.value = lng;
          
          // 2. Abrir Modal
          ui.modal.classList.remove('hidden');
          
          // 3. Desactivar modo selección y restaurar UI
          isSelectionMode = false;
          ui.btnAddReport.innerHTML = originalBtnContent;
          ui.btnAddReport.classList.remove('bg-red-600', 'hover:bg-red-700'); // Quitar color rojo si se puso
          ui.btnAddReport.classList.add('bg-blue-600', 'hover:bg-blue-700'); // Restaurar azul
          document.getElementById('map').style.cursor = ''; // Restaurar cursor
      });
  }

  if (currentUser && ui.headerTitle) {
    ui.headerTitle.innerHTML = `LostNet <span class="text-blue-600 text-xs block">Hola, ${currentUser.given_name}</span>`;
  }

  // --- UI: LÓGICA DEL MENÚ LATERAL ---
  const toggleMenu = (show) => {
    if (ui.menu) {
      if (show) {
        ui.menu.classList.remove('-translate-y-full');
        ui.menu.classList.add('translate-y-0');
      } else {
        ui.menu.classList.add('-translate-y-full');
        ui.menu.classList.remove('translate-y-0');
      }
    }
  };

  if (ui.btnMenu) {
    ui.btnMenu.addEventListener('click', () => {
        const isClosed = ui.menu.classList.contains('-translate-y-full');
        toggleMenu(isClosed); 
    });
  }
  
  if (ui.btnCloseMenu) ui.btnCloseMenu.addEventListener('click', () => toggleMenu(false));

  // Render & Filter Logic
  const render = () => {
    mapController.clear();
    const filteredReports = state.allReports.filter(r => {
      const text = (r.desc_short || r.descripcion || '').toLowerCase();
      const matchText = text.includes(state.filterText.toLowerCase());
      let rCat = r.category;
      if (!rCat || !CONFIG.VALID_CATEGORIES.includes(rCat)) rCat = "Otros";
      const matchCategory = state.filterCategory === 'all' || rCat === state.filterCategory;
      return matchText && matchCategory;
    });

    if(ui.reportsList) ui.reportsList.innerHTML = '';
    if (filteredReports.length === 0 && ui.reportsList) {
        ui.reportsList.innerHTML = '<p class="text-center text-gray-400 text-xs py-10">No se encontraron reportes</p>';
    }

    filteredReports.forEach(r => {
      const isOwner = currentUser && (r.user_id === currentUser.email || r.user_id === currentUser.sub);
      const imgUrl = api.resolveUrl(r.photo_url || r.imagen_url);
      const rCat = CONFIG.VALID_CATEGORIES.includes(r.category) ? r.category : "Otros";
      
      const marker = mapController.addMarker(r, 'REPORT', { isOwner, imageUrl: imgUrl, onContact: handleContact });

      if(ui.reportsList) {
        const card = document.createElement('div');
        card.className = "p-3 bg-white border border-gray-100 rounded-lg hover:shadow-md transition-shadow cursor-pointer flex gap-3";
        card.innerHTML = `
            <div class="w-12 h-12 bg-gray-100 rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center bg-slate-50">
                ${imgUrl ? `<img src="${imgUrl}" class="w-full h-full object-cover">` : `<span class="text-xl">📦</span>`}
            </div>
            <div class="flex-1 min-w-0">
                <h4 class="text-sm font-bold text-gray-700 truncate">${r.desc_short || 'Sin título'}</h4>
                <div class="flex items-center justify-between mt-1">
                    <span class="text-[10px] bg-blue-50 text-blue-600 px-1.5 rounded border border-blue-100">${rCat}</span>
                    <span class="text-[10px] text-gray-400">${r.timestamp ? new Date(r.timestamp * 1000).toLocaleDateString() : ''}</span>
                </div>
            </div>`;
        card.onclick = () => { 
            mapController.flyToLocation(r.lat, r.lon); 
            marker.openPopup(); 
            // Cerrar menú en móvil al hacer clic
            if (window.innerWidth < 640) toggleMenu(false);
        };
        ui.reportsList.appendChild(card);
      }
    });

    state.allSafePoints.forEach(s => mapController.addMarker(s, 'SAFE_POINT'));
    if (ui.stats.reportes) ui.stats.reportes.textContent = filteredReports.length;
    if (ui.stats.seguros) ui.stats.seguros.textContent = state.allSafePoints.length;
  };

  const handleContact = async (ownerId) => {
    try {
      if (!ownerId) return alert("Error: Usuario desconocido");
      const info = await api.fetchContacto(ownerId);
      let msg = "Preferencias de contacto:\n\n";
      if (info.whatsapp) msg += "✅ WhatsApp\n";
      if (info.llamada) msg += "✅ Llamada\n";
      if (info.mensaje) msg += `\nNota: "${info.mensaje}"`;
      alert(msg);
    } catch (e) { alert("No se pudo obtener el contacto."); }
  };

  const loadData = async () => {
    if (!mapController.map) return;
    try {
      if (ui.status) ui.status.innerHTML = '<span class="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span> Sincronizando...';
      const [reportsRes, safesRes, configRes] = await api.fetchData(currentUser);
      if (configRes.status === 'fulfilled') mapController.setColors(configRes.value?.colores_mapa);
      state.allReports = reportsRes.status === 'fulfilled' ? reportsRes.value : [];
      state.allSafePoints = safesRes.status === 'fulfilled' ? safesRes.value : [];
      render();
      if (ui.status) ui.status.innerHTML = '<span class="w-2 h-2 rounded-full bg-green-500"></span> En línea';
    } catch (error) { console.error(error); if (ui.status) ui.status.innerHTML = '<span class="w-2 h-2 rounded-full bg-red-500"></span> Error'; }
  };

  // --- LISTENERS ---
  
  if (ui.btnAddReport) {
    ui.btnAddReport.onclick = () => {
        // Toggle Selection Mode
        if (!isSelectionMode) {
            // Activar Modo Selección
            isSelectionMode = true;
            originalBtnContent = ui.btnAddReport.innerHTML;
            
            // Cambiar visualmente el botón
            ui.btnAddReport.innerHTML = `<span class="text-2xl font-bold">❌</span>`;
            ui.btnAddReport.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            ui.btnAddReport.classList.add('bg-red-600', 'hover:bg-red-700');
            
            // Cambiar cursor del mapa
            document.getElementById('map').style.cursor = 'crosshair';
            
            // Avisar al usuario (simple toast o alert)
            alert("📍 MODO SELECCIÓN:\nHaz clic en el mapa donde quieras colocar el reporte.");
        } else {
            // Cancelar Modo Selección
            isSelectionMode = false;
            ui.btnAddReport.innerHTML = originalBtnContent;
            ui.btnAddReport.classList.remove('bg-red-600', 'hover:bg-red-700');
            ui.btnAddReport.classList.add('bg-blue-600', 'hover:bg-blue-700');
            document.getElementById('map').style.cursor = '';
        }
    };
  }

  if (ui.btnCloseModal) ui.btnCloseModal.onclick = () => ui.modal.classList.add('hidden');

  if (ui.inputPhoto) {
    ui.inputPhoto.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                ui.previewImg.src = e.target.result;
                ui.previewContainer.classList.remove('hidden');
                ui.uploadPlaceholder.classList.add('hidden');
            };
            reader.readAsDataURL(file);
        }
    };
  }

  if (ui.formReport) {
    ui.formReport.onsubmit = async (e) => {
        e.preventDefault();
        
        const formData = new FormData(ui.formReport);
        formData.append('user_id', currentUser.email); 
        formData.append('status', 'LOST');
        formData.append('timestamp', Math.floor(Date.now() / 1000));

        const submitBtn = document.getElementById('btn-submit-report');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = "⏳ Enviando...";
        submitBtn.disabled = true;

        try {
            await api.post(CONFIG.ENDPOINTS.REPORTAR, formData);
            alert("¡Reporte publicado con éxito!");
            ui.modal.classList.add('hidden');
            ui.formReport.reset();
            ui.previewContainer.classList.add('hidden');
            ui.uploadPlaceholder.classList.remove('hidden');
            loadData();
        } catch (error) {
            console.error(error);
            alert("Error al subir el reporte.");
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    };
  }

  if (ui.btnRefresh) ui.btnRefresh.onclick = loadData;
  if (ui.btnLogout) ui.btnLogout.onclick = SessionManager.logout;
  
  if (ui.btnGps) {
      ui.btnGps.onclick = () => {
        ui.btnGps.classList.add('opacity-50', 'cursor-wait');
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                mapController.updateUserLocation(pos.coords.latitude, pos.coords.longitude);
                mapController.flyToUser();
                ui.btnGps.classList.remove('opacity-50', 'cursor-wait');
            },
            () => { alert('Error de GPS'); ui.btnGps.classList.remove('opacity-50', 'cursor-wait'); }
        );
      };
  }

  if (ui.searchInput) {
      ui.searchInput.addEventListener('input', (e) => { state.filterText = e.target.value; render(); });
  }
  if (ui.categoryFilter) {
      ui.categoryFilter.addEventListener('change', (e) => { state.filterCategory = e.target.value; render(); });
  }

  if (window.google && ui.loginBtn) {
    google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: (res) => {
        SessionManager.saveUser(decodeJwtResponse(res.credential));
        window.location.href = CONFIG.ROUTES.DASHBOARD;
      }
    });
    google.accounts.id.renderButton(ui.loginBtn, { theme: "outline", size: "large", width: "250", shape: "pill" });
  }

  if (mapController.map) {
    await loadData();
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            mapController.updateUserLocation(pos.coords.latitude, pos.coords.longitude);
            mapController.flyToUser();
        }, () => console.log("GPS no disponible al inicio (silencioso)")
    );
  }
};

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initApp); } 
else { initApp(); }