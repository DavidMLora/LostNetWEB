/** Report details and comments. Network contracts remain in the injected API service. */
export const createReportDetail = ({ getUser, endpoints = {}, notify, helpers = {} } = {}) => {
  const byId = (id) => document.getElementById(id);
  const modal = byId('view-modal');
  const form = byId('form-comment');
  const input = byId('comment-input');
  const list = byId('comments-list');
  const drafts = new Map();
  const pendingComments = new Set();
  const pendingDeletes = new Set();
  const acknowledgedComments = new Map();
  let api = null;
  let actions = {};
  let current = null;
  let generation = 0;
  let loadGeneration = 0;
  let viewportListening = false;
  let wasVisible = Boolean(modal && !modal.classList.contains('hidden'));
  const viewport = window.visualViewport;
  const visible = () => Boolean(modal && !modal.classList.contains('hidden'));
  const isCurrent = (view) => current === view && view.generation === generation && visible();
  const text = (id, value) => { const node = byId(id); if (node) node.textContent = value == null ? '' : String(value); };
  const hide = (id, hidden) => { const node = byId(id); if (node) node.hidden = hidden; };
  const safeNotify = (message, type = 'info') => { try { notify?.(message, type); } catch { /* Keep local state if a toast is unavailable. */ } };
  const getCurrentUser = () => { try { return getUser?.() || null; } catch { return null; } };
  const getId = (report) => {
    const id = report?.id;
    if (typeof id === 'number') return Number.isFinite(id) ? id : null;
    return typeof id === 'string' && id.trim() ? id : null;
  };
  const isOwner = (view) => {
    if (!view || view.safe || typeof actions.isOwner !== 'function') return false;
    try { return Boolean(actions.isOwner(view.report, getCurrentUser())); } catch { return false; }
  };
  const saveDraft = () => {
    if (!current?.key || current.safe || !input) return;
    if (input.value) drafts.set(current.key, input.value);
    else drafts.delete(current.key);
  };
  const setError = (message = '', focus = false) => {
    const node = byId('comment-error');
    if (!node) return;
    node.textContent = message;
    node.hidden = !message;
    input?.setAttribute('aria-invalid', String(Boolean(message)));
    if (message && focus && visible()) {
      node.tabIndex = -1;
      node.focus({ preventScroll: true });
      node.scrollIntoView({ block: 'nearest' });
    }
  };
  const errorMessage = (error) => {
    const message = typeof error?.message === 'string' ? error.message.replace(/\s+/g, ' ').trim() : '';
    const status = Number(message.match(/^API Error:\s*(\d{3})$/i)?.[1]);
    if (status === 400) return 'No se pudo procesar la solicitud. Revisa los datos e inténtalo de nuevo.';
    if (status === 401 || status === 403) return 'Tu sesión no está autorizada. Inicia sesión de nuevo.';
    if (status === 429) return 'Has realizado demasiadas solicitudes. Inténtalo más tarde.';
    if (error?.name === 'AbortError') return 'Se agotó el tiempo de espera. Revisa tu conexión antes de reintentar.';
    if (error?.name === 'TypeError' || /failed to fetch|fetch failed|network\s?error|network request failed|load failed/i.test(message)) {
      return 'No pudimos conectar con el servidor. Revisa tu conexión.';
    }
    return message || 'Ocurrió un error inesperado.';
  };
  const setSending = (view = current) => {
    if (!view || current !== view) return;
    const pending = Boolean(view.key && pendingComments.has(view.key));
    if (input) input.disabled = pending;
    const send = byId('btn-send-comment');
    if (send) { send.disabled = pending; send.setAttribute('aria-busy', String(pending)); }
    form?.setAttribute('aria-busy', String(pending));
    hide('comment-send-spinner', !pending);
    text('comment-send-label', pending ? 'Enviando…' : 'Enviar');
  };
  const setListState = (message) => {
    if (!list) return;
    const state = document.createElement('p');
    state.className = 'detail-list-state';
    state.textContent = message;
    list.replaceChildren(state);
  };
  const renderComments = (comments) => {
    if (!list) return;
    list.replaceChildren();
    if (!comments.length) setListState('Todavía no hay comentarios.');
    comments.forEach((comment) => {
      const author = typeof comment?.user_name === 'string' && comment.user_name.trim() ? comment.user_name : 'Usuario';
      const article = document.createElement('article');
      article.className = 'detail-comment';
      const avatar = document.createElement('span');
      avatar.className = 'detail-comment-avatar';
      avatar.setAttribute('aria-hidden', 'true');
      avatar.textContent = Array.from(author.trim())[0]?.toLocaleUpperCase('es') || 'U';
      const body = document.createElement('div');
      body.className = 'detail-comment-body';
      const heading = document.createElement('div');
      heading.className = 'detail-comment-heading';
      const name = document.createElement('span');
      name.className = 'detail-comment-author';
      name.textContent = author;
      heading.append(name);
      const formattedDate = comment?.timestamp != null ? helpers.formatReportDate?.(comment.timestamp, { time: true }) : '';
      if (formattedDate) {
        const date = document.createElement('span');
        date.className = 'detail-comment-date';
        date.textContent = formattedDate;
        heading.append(date);
      }
      const content = document.createElement('p');
      content.className = 'detail-comment-text';
      content.textContent = comment?.text == null ? '' : String(comment.text);
      body.append(heading, content);
      article.append(avatar, body);
      list.append(article);
    });
    text('comments-count', comments.length);
  };
  const loadComments = async (view, { afterPost = false } = {}) => {
    if (!view || view.id === null || view.safe || !isCurrent(view)) return false;
    const requestGeneration = ++loadGeneration;
    list?.setAttribute('aria-busy', 'true');
    text('comments-feedback', 'Cargando comentarios…');
    hide('btn-retry-comments', true);
    if (!view.comments.length && !view.loaded) {
      setListState('Cargando comentarios…');
      text('comments-count', '—');
    }
    try {
      if (!api) throw new Error('El servicio no está disponible.');
      const comments = await api.get(endpoints.COMENTARIOS_GET, { report_id: view.id });
      if (!isCurrent(view) || requestGeneration !== loadGeneration) return false;
      list?.setAttribute('aria-busy', 'false');
      if (!Array.isArray(comments)) throw new Error('La respuesta de comentarios no tiene un formato válido.');
      view.comments = comments;
      view.loaded = true;
      acknowledgedComments.delete(view.key);
      renderComments(comments);
      text('comments-feedback', '');
      hide('btn-retry-comments', true);
      if (afterPost) text('comment-confirmation', 'Comentario enviado.');
      return true;
    } catch {
      if (!isCurrent(view) || requestGeneration !== loadGeneration) return false;
      list?.setAttribute('aria-busy', 'false');
      const acknowledged = acknowledgedComments.get(view.key) || [];
      const retained = [...view.comments];
      acknowledged.forEach((comment) => { if (!retained.includes(comment)) retained.push(comment); });
      view.comments = retained;
      if (retained.length) renderComments(retained);
      else if (view.loaded) renderComments([]);
      else { setListState('No pudimos cargar los comentarios.'); text('comments-count', '—'); }
      text('comments-feedback', 'No pudimos actualizar los comentarios. Puedes volver a intentarlo.');
      hide('btn-retry-comments', false);
      if (afterPost) text('comment-confirmation', 'Comentario enviado; no se pudo actualizar la lista.');
      return false;
    }
  };
  const updateViewport = () => {
    if (!visible()) return;
    modal.style.setProperty('--detail-viewport-height', `${viewport?.height || window.innerHeight}px`);
    modal.style.setProperty('--detail-viewport-top', `${viewport?.offsetTop || 0}px`);
  };
  const syncVisibility = () => {
    const nowVisible = visible();
    if (!nowVisible && wasVisible) { saveDraft(); generation += 1; loadGeneration += 1; }
    wasVisible = nowVisible;
    if (nowVisible) {
      updateViewport();
      if (viewportListening) return;
      viewport?.addEventListener('resize', updateViewport);
      viewport?.addEventListener('scroll', updateViewport);
      window.addEventListener('resize', updateViewport);
      viewportListening = true;
    } else {
      if (viewportListening) {
        viewport?.removeEventListener('resize', updateViewport);
        viewport?.removeEventListener('scroll', updateViewport);
        window.removeEventListener('resize', updateViewport);
      }
      viewportListening = false;
      modal?.style.removeProperty('--detail-viewport-height');
      modal?.style.removeProperty('--detail-viewport-top');
    }
  };
  const close = () => { modal?.classList.add('hidden'); syncVisibility(); };
  const open = (report, options = {}) => {
    if (!modal || !report) return;
    const replacingVisible = visible();
    if (replacingVisible) saveDraft();
    const scrollContent = byId('view-modal-content');
    if (scrollContent) scrollContent.scrollTop = 0;
    generation += 1;
    loadGeneration += 1;
    const id = getId(report);
    const safe = options.kind === 'safe';
    const view = { report, options, id, key: id === null ? null : `${safe ? 'safe:' : 'report:'}${String(id).trim()}`, safe, kind: safe ? 'safe' : 'report', generation, loaded: false, comments: [] };
    current = view;
    const reportType = view.safe ? { key: 'safe', label: 'Punto seguro' } : helpers.getReportType?.(report) || { key: 'unknown', label: 'Reporte' };
    text('detail-type', reportType.label || 'Reporte');
    if (byId('detail-type')) byId('detail-type').dataset.type = reportType.key || 'unknown';
    const category = view.safe ? '' : helpers.getReportCategory?.(report) || '';
    text('detail-category', category);
    hide('detail-category', !category);

    // Recompensa
    const reward = Number(report?.reward ?? report?.recompensa ?? 0);
    const hasReward = !view.safe && Number.isFinite(reward) && reward > 0;
    hide('detail-reward-section', !hasReward);
    hide('detail-reward-badge', !hasReward);
    if (hasReward) {
      const formattedReward = reward.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      text('detail-reward-amount', formattedReward);
      text('detail-reward-badge-amount', reward.toLocaleString('es-MX'));
    }

    text('detail-title', view.safe ? report.nombre || 'Punto seguro' : helpers.getReportTitle?.(report) || 'Sin título');
    const date = view.safe ? '' : typeof helpers.getReportDate === 'function'
      ? helpers.getReportDate(report) || ''
      : report.timestamp != null ? helpers.formatReportDate?.(report.timestamp) || '' : '';
    text('detail-date', date);
    hide('detail-date', !date);
    const owner = isOwner(view);
    hide('detail-own', !owner);
    text('detail-publisher', view.safe ? 'Punto seguro' : report.email ? helpers.maskPublicEmail?.(report.email) || 'Usuario' : 'Usuario');

    // Sistema de honor y enlace al perfil
    const honorPoints = Number(report?.user_honor ?? report?.honor_points ?? report?.user?.honor ?? 0);
    const hasHonor = !view.safe && Number.isFinite(honorPoints) && honorPoints > 0;
    hide('detail-publisher-honor', !hasHonor);
    if (hasHonor) text('detail-honor-points', honorPoints);
    const profileBtn = byId('btn-view-profile');
    if (profileBtn) profileBtn.hidden = view.safe;

    // Reporte de falsos / IA
    const reportFakeBtn = byId('btn-report-fake');
    if (reportFakeBtn) reportFakeBtn.hidden = view.safe || owner || id === null;

    const coords = helpers.getReportCoordinates?.(report) || null;
    view.coords = coords;
    hide('detail-location-section', !coords);
    text('detail-location-text', coords ? helpers.getLocationLabel?.(report) || '' : '');
    const mapButton = byId('btn-detail-map');
    if (mapButton) mapButton.disabled = !coords || typeof actions.locate !== 'function';
    const question = !view.safe && typeof report.security_question === 'string' ? report.security_question.trim() : '';
    const hasQuestion = Boolean(question && question.toUpperCase() !== 'N/A');
    hide('detail-security-section', !hasQuestion);
    text('detail-security-question', hasQuestion ? question : '');
    const link = !view.safe ? helpers.getWhatsAppLink?.(report) || '' : '';
    const whatsApp = byId('btn-whatsapp-action');
    if (whatsApp) {
      whatsApp.hidden = !link;
      if (link) { whatsApp.href = link; whatsApp.target = '_blank'; whatsApp.rel = 'noopener noreferrer'; }
      else whatsApp.removeAttribute('href');
    }
    const phone = typeof report.phone === 'string' || typeof report.phone === 'number' ? String(report.phone).replace(/\D/g, '') : '';
    text('detail-contact-note', view.safe ? report.horario || 'Horario no indicado.' : link && phone ? `Teléfono público: ••• ••• ${phone.slice(-2)}` : 'Este reporte no tiene un teléfono público de contacto.');
    const deleteButton = byId('btn-detail-delete');
    hide('btn-detail-delete', !owner || id === null || typeof actions.deleteReport !== 'function');
    if (deleteButton) deleteButton.disabled = Boolean(view.key && pendingDeletes.has(view.key));
    const image = byId('detail-hero-image');
    const imageUrl = helpers.getReportImage?.(report, api) || '';
    hide('detail-hero-image', true);
    hide('detail-image-fallback', false);
    if (image) {
      image.onload = null;
      image.onerror = null;
      image.removeAttribute('src');
      image.alt = view.safe ? 'Foto del punto seguro' : 'Foto del objeto reportado';
      if (imageUrl) {
        image.onload = () => { if (current === view && view.generation === generation) { image.hidden = false; hide('detail-image-fallback', true); } };
        image.onerror = () => { if (current === view && view.generation === generation) { image.hidden = true; hide('detail-image-fallback', false); } };
        image.src = imageUrl;
      }
    }
    setError();
    text('comment-confirmation', '');
    text('comments-feedback', '');
    hide('btn-retry-comments', true);
    if (input) input.value = view.key ? drafts.get(view.key) || '' : '';
    if (form) form.hidden = view.safe || id === null;
    if (view.safe || id === null) {
      list?.setAttribute('aria-busy', 'false');
      setListState(view.safe ? 'Los puntos seguros no tienen comentarios.' : 'Este reporte no tiene identificador para consultar comentarios.');
      text('comments-count', '—');
    } else {
      view.comments = [...(acknowledgedComments.get(view.key) || [])];
      if (view.comments.length) renderComments(view.comments);
      else setListState('Cargando comentarios…');
    }
    setSending(view);
    modal.classList.remove('hidden');
    syncVisibility();
    if (replacingVisible) byId('btn-close-view')?.focus();
    if (id !== null && !view.safe) void loadComments(view);
  };
  byId('btn-close-view')?.addEventListener('click', close);
  byId('btn-retry-comments')?.addEventListener('click', () => { if (current) void loadComments(current); });
  byId('btn-detail-map')?.addEventListener('click', () => {
    const view = current;
    if (!view?.coords || typeof actions.locate !== 'function') return;
    close();
    actions.locate(view.report, view.coords, { kind: view.kind });
  });

  // Modal / Acción para ver perfil y reputación
  byId('btn-view-profile')?.addEventListener('click', () => {
    const view = current;
    if (!view || view.safe) return;
    if (typeof actions.viewProfile === 'function') {
      actions.viewProfile(view.report);
    } else {
      const author = view.report?.email ? helpers.maskPublicEmail?.(view.report.email) : 'Usuario';
      const points = Number(view.report?.user_honor ?? view.report?.honor_points ?? 0);
      safeNotify(`Autor: ${author} | Reputación: ${points} pts de honor`, 'info');
    }
  });

  // Acción para denunciar reporte falso o imagen generada por IA
  byId('btn-report-fake')?.addEventListener('click', async () => {
    const view = current;
    if (!view || view.safe || view.id === null) return;
    const user = getCurrentUser();
    if (!user) {
      safeNotify('Debes iniciar sesión para reportar una publicación.', 'error');
      return;
    }
    const reason = window.prompt('Indica el motivo del reporte:\n1. Imagen generada por IA\n2. Objeto falso o broma\n3. Fraude o sospechoso\n\nEscribe el motivo:');
    if (!reason || !reason.trim()) return;

    try {
      if (typeof actions.reportFake === 'function') {
        await actions.reportFake(view.id, reason.trim(), view.report);
      } else if (api && endpoints.REPORTAR_FALSO_POST) {
        await api.post(endpoints.REPORTAR_FALSO_POST, { report_id: view.id, reason: reason.trim() }, true);
      }
      safeNotify('Publicación reportada. El equipo de moderación revisará el reporte.', 'success');
    } catch (error) {
      safeNotify(errorMessage(error) || 'No pudimos enviar el reporte de moderación.', 'error');
    }
  });

  byId('btn-detail-delete')?.addEventListener('click', async () => {
    const view = current;
    if (!view || view.id === null || !view.key || pendingDeletes.has(view.key) || typeof actions.deleteReport !== 'function') return;
    if (!isOwner(view)) { hide('btn-detail-delete', true); return; }
    pendingDeletes.add(view.key);
    const button = byId('btn-detail-delete');
    if (button) button.disabled = true;
    try {
      const deleted = await actions.deleteReport(view.id, view.report);
      if (deleted === true && current?.key === view.key && visible()) close();
    } catch (error) { safeNotify(typeof error?.message === 'string' ? error.message : 'No pudimos eliminar el reporte.', 'error'); }
    finally {
      pendingDeletes.delete(view.key);
      if (current?.key === view.key && button) button.disabled = false;
    }
  });
  input?.addEventListener('input', () => {
    if (!current?.key) return;
    saveDraft();
    if (input.value.trim()) setError();
    text('comment-confirmation', '');
  });
  if (form) {
    form.noValidate = true;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const view = current;
      if (!view || view.safe || view.id === null || !view.key || pendingComments.has(view.key)) return;
      saveDraft();
      const commentText = input?.value.trim() || '';
      if (!commentText) { setError('Escribe un comentario antes de enviarlo.'); input?.focus(); return; }
      const user = getCurrentUser();
      if (!user) { setError('Inicia sesión de nuevo para comentar. Conservamos tu borrador.', true); return; }
      const payload = { report_id: view.id, user_name: user.given_name || user.name || 'Usuario LostNet', text: commentText };
      pendingComments.add(view.key);
      setError();
      text('comment-confirmation', '');
      setSending(view);
      try {
        if (!api) throw new Error('El servicio no está disponible.');
        const result = await api.post(endpoints.COMENTAR_POST, payload, true);
        const acknowledged = { user_name: payload.user_name, text: payload.text, timestamp: result?.timestamp ?? result?.comment?.timestamp ?? Math.floor(Date.now() / 1000) };
        const earlier = acknowledgedComments.get(view.key) || [];
        acknowledgedComments.set(view.key, [...earlier, acknowledged]);
        drafts.delete(view.key);
        if (current?.key === view.key && visible()) {
          if (input) input.value = '';
          setError();
          text('comment-confirmation', 'Comentario enviado.');
          await loadComments(current, { afterPost: true });
        } else safeNotify('Comentario enviado.', 'success');
      } catch (error) {
        const message = errorMessage(error);
        if (current?.key === view.key && visible()) setError(message, true);
        else safeNotify(message, 'error');
      } finally {
        pendingComments.delete(view.key);
        if (current?.key === view.key) setSending(current);
      }
    });
  }
  if (modal) new MutationObserver(syncVisibility).observe(modal, { attributes: true, attributeFilter: ['class'] });
  syncVisibility();
  const controller = {
    init(apiService, nextActions = {}) { api = apiService; actions = nextActions; return controller; },
    open,
    close
  };
  return controller;
};