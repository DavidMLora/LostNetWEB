/** Presentation state only; app.js owns REST requests and Leaflet. */
export const initDashboardUI = (currentUser) => {
  const root = document.querySelector('.lostnet-dashboard');
  const byId = (id) => document.getElementById(id);
  const tabs = [...(root?.querySelectorAll('[role="tab"][data-tab]') || [])];
  const names = ['explore', 'you', 'help'];
  const content = byId('sheet-content');
  const handle = byId('btn-sheet-toggle');
  const expand = (expanded) => {
    if (!root) return;
    if (!expanded && content?.contains(document.activeElement)) handle?.focus();
    root.dataset.panelExpanded = String(expanded);
    if (content) content.hidden = !expanded;
    handle?.setAttribute('aria-expanded', String(expanded));
    handle?.setAttribute('aria-label', expanded ? 'Contraer panel' : 'Expandir panel');
    byId('btn-close-menu')?.setAttribute('aria-expanded', String(expanded));
    byId('btn-close-menu')?.setAttribute('aria-label', expanded ? 'Contraer panel' : 'Expandir panel');
  };
  const selectTab = (name) => {
    const heading = byId('sheet-title');
    if (heading) heading.textContent = {
      explore: 'Explorar', you: 'Tu perfil', help: 'Cómo funciona'
    }[name];
    tabs.forEach((tab) => {
      const selected = tab.dataset.tab === name;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    names.forEach((item) => {
      const panel = byId(`panel-${item}`);
      if (panel) {
        const shouldHide = item !== name;
        const containedFocus = shouldHide && panel.contains(document.activeElement);
        panel.hidden = shouldHide;
        if (containedFocus) byId(`tab-${name}`)?.focus();
      }
    });
  };
  const openTab = (name) => {
    if (!names.includes(name)) return;
    selectTab(name);
    expand(true);
  };
  const collapsePanel = () => expand(false);
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => openTab(tab.dataset.tab));
    tab.addEventListener('keydown', (event) => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      openTab(tabs[next].dataset.tab);
      tabs[next].focus();
    });
  });
  let pointerStart = null;
  let suppressClickUntil = 0;
  handle?.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    pointerStart = { id: event.pointerId, y: event.clientY };
    try { handle.setPointerCapture(event.pointerId); } catch { /* Optional capture. */ }
  });
  handle?.addEventListener('pointerup', (event) => {
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    const distance = event.clientY - pointerStart.y;
    pointerStart = null;
    if (Math.abs(distance) < 30) return;
    suppressClickUntil = Date.now() + 500;
    expand(distance < 0);
  });
  handle?.addEventListener('pointercancel', () => { pointerStart = null; });
  handle?.addEventListener('click', (event) => {
    if (event.detail > 0 && Date.now() < suppressClickUntil) {
      event.preventDefault();
      return;
    }
    expand(root?.dataset.panelExpanded !== 'true');
  });
  byId('btn-close-menu')?.addEventListener('click', () => expand(root?.dataset.panelExpanded !== 'true'));
  byId('btn-profile')?.addEventListener('click', () => openTab('you'));
  const categories = [...document.querySelectorAll('.filter-cat')];
  const summarize = () => {
    const count = categories.filter((input) => input.checked).length;
    byId('filter-all')?.setAttribute('aria-pressed', String(count === 0));
    const summary = byId('category-summary');
    if (summary) summary.textContent = count === 0 ? 'Todas las categorías' : `${count} ${count === 1 ? 'categoría' : 'categorías'}`;
  };
  const uncheck = (input) => {
    if (!input?.checked) return;
    input.checked = false;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const clearCategories = () => {
    categories.forEach(uncheck);
    summarize();
    const strip = root?.querySelector('.category-strip');
    if (strip) strip.scrollLeft = 0;
  };
  categories.forEach((input) => input.addEventListener('change', summarize));
  byId('filter-all')?.addEventListener('click', clearCategories);
  byId('btn-clear-filters')?.addEventListener('click', () => {
    const search = byId('search-input');
    if (search?.value) {
      search.value = '';
      search.dispatchEvent(new Event('input', { bubbles: true }));
    }
    clearCategories();
    uncheck(byId('filter-mine'));
    uncheck(byId('filter-nearby'));
  });
  byId('btn-my-reports')?.addEventListener('click', () => {
    const mine = byId('filter-mine');
    if (mine && !mine.checked) {
      mine.checked = true;
      mine.dispatchEvent(new Event('change', { bubbles: true }));
    }
    openTab('explore');
  });
  const name = currentUser?.name || currentUser?.given_name || 'Tu perfil';
  const email = currentUser?.email || 'Cuenta de LostNet';
  const initials = String(currentUser?.name || currentUser?.given_name || currentUser?.email || 'LN')
    .trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toLocaleUpperCase('es') || 'LN';
  if (byId('profile-name')) byId('profile-name').textContent = name;
  if (byId('profile-email')) byId('profile-email').textContent = email;
  ['profile-initials', 'account-initials'].forEach((id) => {
    if (byId(id)) byId(id).textContent = initials;
  });
  let pictureUrl;
  try {
    const candidate = new URL(currentUser?.picture);
    if (['https:', 'http:'].includes(candidate.protocol)) pictureUrl = candidate.href;
  } catch { /* Keep initials when there is no valid account picture URL. */ }
  ['profile', 'account'].forEach((prefix) => {
    const photo = byId(`${prefix}-photo`);
    const fallback = byId(`${prefix}-initials`);
    if (!photo || !pictureUrl) return;
    photo.onload = () => { photo.hidden = false; if (fallback) fallback.hidden = true; };
    photo.onerror = () => { photo.hidden = true; if (fallback) fallback.hidden = false; };
    photo.alt = `Foto de ${name}`;
    photo.src = pictureUrl;
  });
  byId('btn-help-report')?.addEventListener('click', () => byId('btn-add-report')?.click());
  byId('btn-cancel-selection')?.addEventListener('click', () => byId('btn-add-report')?.click());
  const setConnection = (state) => {
    if (!['loading', 'online', 'offline'].includes(state)) return;
    if (root) root.dataset.connection = state;
    const feedback = byId('reports-feedback');
    if (feedback) feedback.textContent = {
      loading: 'Buscando reportes…',
      online: 'Reportes actualizados.',
      offline: 'No pudimos actualizar los reportes. Revisa tu conexión e inténtalo de nuevo.'
    }[state];
  };
  const setSelectionMode = (active) => {
    if (root) root.dataset.selecting = String(Boolean(active));
    const hint = byId('selection-hint');
    if (hint) hint.hidden = !active;
    const label = byId('report-action-label');
    if (label) label.textContent = active ? 'Cancelar' : 'Reportar objeto';
    byId('btn-add-report')?.setAttribute('aria-pressed', String(Boolean(active)));
    byId('btn-add-report')?.setAttribute('aria-label', active ? 'Cancelar selección de ubicación' : 'Crear un reporte: selecciona una ubicación en el mapa');
  };
  selectTab(tabs.find((tab) => tab.getAttribute('aria-selected') === 'true')?.dataset.tab || 'explore');
  expand(!window.matchMedia('(max-width: 767px)').matches);
  summarize();
  setSelectionMode(false);
  return { collapsePanel, openTab, setConnection, setSelectionMode };
};

