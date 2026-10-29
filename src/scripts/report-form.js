/** Report creation presentation. The caller owns API contracts and map state. */
export const initReportForm = ({ getUser, publish, onPublished, onChangeLocation, notify } = {}) => {
  const byId = (id) => document.getElementById(id);
  const modal = byId('report-modal');
  const form = byId('form-report');
  if (!modal || !form) return { open() {}, close() {}, isSubmitting: () => false };

  const photoInput = byId('input-photo');
  const description = byId('report-description');
  const latitude = byId('input-lat');
  const longitude = byId('input-lon');
  const rewardGroup = byId('report-reward-group');
  const rewardInput = byId('report-reward');
  const submitButton = byId('btn-submit-report');
  const submitLabel = byId('report-submit-label');
  const submitSpinner = byId('report-submit-spinner');
  const submitStatus = byId('report-submit-status');
  const formError = byId('report-form-error');
  const successPanel = byId('report-success');
  const preview = byId('preview-container');
  const previewImage = byId('preview-img');
  const placeholder = byId('upload-placeholder');
  const filename = byId('photo-filename');
  const categories = ['Electrónica', 'Ropa', 'Documentos', 'Otros'];
  const statuses = ['LOST', 'FOUND'];
  const touched = new Set();
  let submitting = false;
  let completed = false;
  let photoReadFailed = false;
  let previewGeneration = 0;
  let activeReader = null;
  let disabledStates = [];
  let viewportListening = false;
  const viewport = window.visualViewport;
  const isVisible = () => !modal.classList.contains('hidden');
  form.noValidate = true;

  const checkedValue = (name) => form.querySelector(`input[name="${name}"]:checked`)?.value;

  const updateRewardVisibility = () => {
    const isLost = checkedValue('status') === 'LOST';
    if (rewardGroup) rewardGroup.hidden = !isLost;
    if (!isLost && rewardInput) rewardInput.value = '';
  };

  const setFormError = (message = '') => {
    if (!formError) return;
    formError.textContent = message;
    formError.hidden = !message;
  };

  const publicationErrorMessage = (error) => {
    const message = typeof error?.message === 'string' ? error.message.replace(/\s+/g, ' ').trim() : '';

    if (/ia|inteligencia artificial|deepfake|fake|manipulad/i.test(message)) {
      return 'La imagen subida fue rechazada: parece haber sido generada o alterada digitalmente.';
    }

    const apiStatus = Number(message.match(/^API Error:\s*(\d{3})$/i)?.[1]);
    if (apiStatus === 422 || apiStatus === 400) {
      return message.replace(/^API Error:\s*\d{3}\s*-?\s*/i, '') || 'Revisa los datos del reporte e inténtalo de nuevo.';
    }
    if (apiStatus === 429) return 'Has realizado demasiadas solicitudes. Inténtalo más tarde.';
    if (apiStatus === 401) return 'Tu sesión no está autorizada. Inicia sesión de nuevo para publicar.';
    if (apiStatus === 403) return 'No tienes autorización para publicar este reporte. Revisa tu sesión.';
    if (error?.name === 'AbortError') return 'Se agotó el tiempo de espera. No podemos confirmar la publicación. Comprueba tus reportes antes de reintentar.';
    if (error?.name === 'TypeError' || /failed to fetch|fetch failed|network\s?error|network request failed|load failed/i.test(message)) {
      return 'No pudimos confirmar la publicación. Revisa tu conexión antes de reintentar.';
    }
    return message || 'No pudimos confirmar la publicación. Comprueba tus reportes antes de reintentar.';
  };

  const setFieldError = (input, errorId, message, validClass = true) => {
    const error = byId(errorId);
    if (error) { error.textContent = message; error.hidden = !message; }
    if (!input) return;
    input.setAttribute('aria-invalid', String(Boolean(message)));
    if (error) {
      const describedBy = new Set((input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
      describedBy.add(errorId);
      input.setAttribute('aria-describedby', [...describedBy].join(' '));
    }
    input.classList.toggle('is-valid', validClass && !message);
  };

  const validateDescription = () => {
    if (!description) return true;
    description.setCustomValidity('');
    let message = '';
    if (!description.value.trim()) message = 'Escribe una descripción del objeto.';
    else if (description.value.length > 30) message = 'Usa un máximo de 30 caracteres.';
    else if (!description.validity.valid) message = description.validationMessage;
    description.setCustomValidity(message);
    if (touched.has('description')) setFieldError(description, 'report-description-error', message);
    return !message;
  };

  const validatePhoto = () => {
    if (!photoInput) return true;
    photoInput.setCustomValidity('');
    const photo = photoInput.files?.[0];
    let message = '';
    if (!photo) message = 'Añade una foto del objeto.';
    else if (photo.type && !photo.type.toLowerCase().startsWith('image/')) message = 'Selecciona un archivo de imagen.';
    else if (/dall[e\-]|midjourney|stablediffusion/i.test(photo.name)) message = 'El archivo parece ser generado por IA. Selecciona una foto real.';
    else if (photoReadFailed) message = 'No pudimos leer esta foto. Selecciónala de nuevo o elige otra.';
    else if (!photoInput.validity.valid) message = photoInput.validationMessage;
    photoInput.setCustomValidity(message);
    if (touched.has('photo')) setFieldError(photoInput, 'report-photo-error', message);
    return !message;
  };

  const validateCategory = () => {
    const radios = [...form.querySelectorAll('input[name="category"]')];
    const message = categories.includes(checkedValue('category')) ? '' : 'Selecciona una categoría para el objeto.';
    radios.forEach((radio) => {
      radio.setCustomValidity(message);
      if (touched.has('category')) {
        radio.setAttribute('aria-invalid', String(Boolean(message)));
        radio.classList.toggle('is-valid', !message && radio.checked);
      }
    });
    if (touched.has('category')) setFieldError(byId('report-category-options'), 'report-category-error', message);
    return !message;
  };

  const validateStatus = () => {
    const valid = statuses.includes(checkedValue('status'));
    form.querySelectorAll('input[name="status"]').forEach((radio) => {
      radio.setCustomValidity(valid ? '' : 'Selecciona si el objeto está perdido o encontrado.');
      if (touched.has('status')) {
        radio.setAttribute('aria-invalid', String(!valid));
        radio.classList.toggle('is-valid', valid && radio.checked);
      }
    });
    return valid;
  };

  const updateCount = () => {
    const count = byId('report-description-count');
    if (count) count.textContent = `${description?.value.length || 0}/30`;
  };

  const clearPreview = () => {
    previewGeneration += 1;
    if (activeReader?.readyState === 1) activeReader.abort();
    activeReader = null;
    if (preview) preview.hidden = true;
    if (placeholder) placeholder.hidden = false;
    if (previewImage) {
      previewImage.onerror = null;
      previewImage.removeAttribute('src');
    }
    const removeButton = byId('btn-remove-photo');
    if (removeButton) removeButton.hidden = true;
    if (filename) filename.textContent = 'Ningún archivo seleccionado';
    const previewNote = byId('report-photo-preview-note');
    if (previewNote) { previewNote.textContent = ''; previewNote.hidden = true; }
  };

  const readPhoto = () => {
    clearPreview();
    photoReadFailed = false;
    if (!validatePhoto()) return;
    const file = photoInput?.files?.[0];
    if (!file) return;
    const generation = previewGeneration;
    const reader = new FileReader();
    activeReader = reader;
    if (filename) filename.textContent = file.name;
    const removeButton = byId('btn-remove-photo');
    if (removeButton) removeButton.hidden = false;
    reader.onload = () => {
      if (generation !== previewGeneration) return;
      activeReader = null;
      if (previewImage && typeof reader.result === 'string') {
        const source = reader.result;
        previewImage.onerror = () => {
          if (generation !== previewGeneration || previewImage.getAttribute('src') !== source) return;
          if (previewImage.currentSrc && previewImage.currentSrc !== source) return;
          const previewNote = byId('report-photo-preview-note');
          if (previewNote) {
            previewNote.textContent = 'No se pudo mostrar la vista previa. La imagen sigue adjunta.';
            previewNote.hidden = false;
          }
          if (preview) preview.hidden = true;
          if (placeholder) placeholder.hidden = false;
          previewImage.onerror = null;
          previewImage.removeAttribute('src');
          validatePhoto();
        };
        previewImage.src = source;
      }
      if (preview) preview.hidden = false;
      if (placeholder) placeholder.hidden = true;
    };
    reader.onerror = () => {
      if (generation !== previewGeneration) return;
      activeReader = null;
      photoReadFailed = true;
      validatePhoto();
    };
    try { reader.readAsDataURL(file); }
    catch {
      if (generation !== previewGeneration) return;
      activeReader = null;
      photoReadFailed = true;
      validatePhoto();
    }
  };

  const resetAnswerVisibility = () => {
    const answer = byId('report-security-answer');
    const toggle = byId('btn-toggle-answer');
    if (answer) answer.type = 'password';
    toggle?.setAttribute('aria-pressed', 'false');
    toggle?.setAttribute('aria-label', 'Mostrar respuesta');
    if (toggle) toggle.textContent = 'Mostrar';
  };

  const resetDraft = () => {
    form.reset();
    touched.clear();
    clearPreview();
    photoReadFailed = false;
    form.querySelectorAll('input,select,textarea').forEach((input) => {
      input.setCustomValidity('');
      input.classList.remove('is-valid');
      input.setAttribute('aria-invalid', 'false');
    });
    ['report-photo-error', 'report-description-error', 'report-category-error'].forEach((id) => {
      const error = byId(id);
      if (error) { error.textContent = ''; error.hidden = true; }
    });
    byId('report-category-options')?.classList.remove('is-valid');
    byId('report-category-options')?.setAttribute('aria-invalid', 'false');
    if (submitStatus) submitStatus.textContent = '';
    const locationText = byId('report-location-text');
    if (locationText) locationText.textContent = 'Selecciona una ubicación en el mapa.';
    setFormError();
    updateCount();
    resetAnswerVisibility();
    updateRewardVisibility();
  };

  const updateViewport = () => {
    if (!isVisible()) return;
    modal.style.setProperty('--report-viewport-height', `${viewport?.height || window.innerHeight}px`);
    modal.style.setProperty('--report-viewport-top', `${viewport?.offsetTop || 0}px`);
  };

  const syncViewport = () => {
    if (isVisible()) {
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
      modal.style.removeProperty('--report-viewport-height');
      modal.style.removeProperty('--report-viewport-top');
    }
  };

  new MutationObserver(syncViewport).observe(modal, { attributes: true, attributeFilter: ['class'] });

  const close = () => {
    modal.classList.add('hidden');
    syncViewport();
  };

  const open = (lat, lon) => {
    if (completed && !submitting) {
      completed = false;
      if (successPanel) successPanel.hidden = true;
      form.hidden = false;
    }
    if (!submitting && (lat !== undefined || lon !== undefined)) {
      if (latitude) latitude.value = lat == null ? '' : String(lat);
      if (longitude) longitude.value = lon == null ? '' : String(lon);
      const valid = latitude?.value.trim() && longitude?.value.trim() && Number.isFinite(Number(latitude.value)) && Number.isFinite(Number(longitude.value));
      const locationText = byId('report-location-text');
      if (locationText) locationText.textContent = valid
        ? `${Number(latitude.value).toFixed(5)}, ${Number(longitude.value).toFixed(5)}`
        : 'Ubicación pendiente. Vuelve al mapa para seleccionar un punto.';
    }
    updateRewardVisibility();
    modal.classList.remove('hidden');
    syncViewport();
  };

  const setPending = (pending) => {
    modal.dataset.submitting = String(pending);
    form.setAttribute('aria-busy', String(pending));
    submitButton?.setAttribute('aria-busy', String(pending));
    if (submitLabel) submitLabel.textContent = pending ? 'Publicando…' : 'Publicar reporte';
    if (submitSpinner) submitSpinner.hidden = !pending;
    if (submitStatus) submitStatus.textContent = pending ? 'Publicando tu reporte. Puedes cerrar esta ventana mientras termina.' : '';
    if (pending) {
      disabledStates = [...new Set([...form.querySelectorAll('input,select,textarea,button'), submitButton, byId('btn-change-location')].filter(Boolean))]
        .filter((control) => !['btn-close-modal', 'btn-report-done'].includes(control.id))
        .map((control) => [control, control.disabled]);
      disabledStates.forEach(([control]) => { control.disabled = true; });
    } else {
      disabledStates.forEach(([control, wasDisabled]) => { control.disabled = wasDisabled; });
      disabledStates = [];
    }
  };

  description?.addEventListener('input', () => {
    updateCount();
    if (touched.has('description')) validateDescription();
  });
  description?.addEventListener('blur', () => { touched.add('description'); validateDescription(); });
  photoInput?.addEventListener('change', () => { touched.add('photo'); readPhoto(); });
  byId('btn-remove-photo')?.addEventListener('click', () => {
    if (submitting) return;
    if (photoInput) photoInput.value = '';
    clearPreview();
    photoReadFailed = false;
    touched.add('photo');
    validatePhoto();
  });
  form.querySelectorAll('input[name="category"]').forEach((radio) => radio.addEventListener('change', () => {
    touched.add('category'); validateCategory();
  }));
  form.querySelectorAll('input[name="status"]').forEach((radio) => radio.addEventListener('change', () => {
    touched.add('status'); 
    validateStatus();
    updateRewardVisibility();
  }));
  byId('btn-toggle-answer')?.addEventListener('click', () => {
    const answer = byId('report-security-answer');
    const toggle = byId('btn-toggle-answer');
    if (!answer || !toggle || submitting) return;
    const visible = answer.type === 'password';
    answer.type = visible ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(visible));
    toggle.setAttribute('aria-label', visible ? 'Ocultar respuesta' : 'Mostrar respuesta');
    toggle.textContent = visible ? 'Ocultar' : 'Mostrar';
  });
  byId('btn-close-modal')?.addEventListener('click', close);
  byId('btn-report-done')?.addEventListener('click', close);
  byId('btn-change-location')?.addEventListener('click', () => {
    if (submitting) return;
    close();
    onChangeLocation?.();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    setFormError();
    ['photo', 'description', 'category', 'status'].forEach((name) => touched.add(name));
    const fieldResults = [validatePhoto(), validateDescription(), validateCategory(), validateStatus()];
    const nativeValid = form.checkValidity();
    if (fieldResults.includes(false) || !nativeValid) {
      if (!fieldResults[3]) setFormError('Selecciona si el objeto está perdido o encontrado.');
      else if (!nativeValid && fieldResults.every(Boolean)) setFormError('Revisa los campos marcados antes de publicar.');
      const firstInvalid = [...form.querySelectorAll('input,select,textarea')].find((input) => input.willValidate && !input.validity.valid);
      firstInvalid?.focus();
      return;
    }
    const fields = new FormData(form);
    const photo = photoInput?.files?.[0] || null;
    const lat = String(fields.get('lat') ?? latitude?.value ?? '').trim();
    const lon = String(fields.get('lon') ?? longitude?.value ?? '').trim();
    if (!lat || !lon || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
      setFormError('Falta una ubicación válida. Usa Cambiar para elegir un punto en el mapa.');
      byId('btn-change-location')?.focus();
      return;
    }
    let user;
    try { user = getUser?.(); } catch { user = null; }
    if (!user) {
      setFormError('Tu sesión ha expirado. Inicia sesión de nuevo para publicar; conservamos tu borrador.');
      return;
    }
    submitting = true;
    setPending(true);
    try {
      if (typeof publish !== 'function') throw new Error('No se pudo iniciar la publicación. Inténtalo de nuevo.');
      const result = await publish({ user, fields, photo });
      resetDraft();
      completed = true;
      if (isVisible()) {
        form.hidden = true;
        if (successPanel) successPanel.hidden = false;
        const message = byId('report-success-message');
        if (message) message.textContent = 'El reporte se publicó correctamente.';
        byId('btn-report-done')?.focus();
      }
      try { onPublished?.(result); } catch (error) { console.error('LostNet: no se pudo actualizar la vista después de publicar.', error); }
      try { notify?.('¡Reporte publicado!', 'success'); } catch { /* A toast must not change a successful result. */ }
    } catch (error) {
      setFormError(publicationErrorMessage(error));
      if (isVisible() && formError) {
        formError.tabIndex = -1;
        formError.focus({ preventScroll: true });
        formError.scrollIntoView({ block: 'nearest' });
      } else if (!isVisible()) {
        try { notify?.(publicationErrorMessage(error), 'error'); } catch { /* The draft and inline error remain available. */ }
      }
    } finally {
      submitting = false;
      setPending(false);
    }
  });

  updateCount();
  resetAnswerVisibility();
  updateRewardVisibility();
  syncViewport();
  return { open, close, isSubmitting: () => submitting };
};