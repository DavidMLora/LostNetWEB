import {
  icon, getReportTitle, getReportType, getReportCoordinates, getReportCategory,
  getReportDate, getReportDateISO, getReportImage, getReportKey
} from './reports-utils.js';

const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const addIcon = (parent, name, size = 18) => {
  const holder = element('span', 'rpt-icon');
  holder.setAttribute('aria-hidden', 'true');
  holder.innerHTML = icon(name, size);
  parent.appendChild(holder);
};
const validIdentifier = (id) => (typeof id === 'string' && id.trim() !== '')
  || (typeof id === 'number' && Number.isFinite(id));
const distanceLabel = (distance) => {
  if (typeof distance !== 'number' || !Number.isFinite(distance) || distance < 0) return '';
  if (distance < 1000) return 'A ' + Math.round(distance).toLocaleString('es-MX') + ' m de ti';
  return 'A ' + (distance / 1000).toLocaleString('es-MX', { maximumFractionDigits: 1 }) + ' km de ti';
};

/** A report row with separate native controls for locating, reading and deleting. */
export const createReportCard = (report, {
  api, isOwner = false, distanceMeters, onLocate, onDetails, onDelete, selected = false
} = {}) => {
  const title = getReportTitle(report);
  const type = getReportType(report);
  const coordinates = getReportCoordinates(report);
  const card = element('article', 'report-card rpt-card');
  card.dataset.reportKey = getReportKey(report);
  card.dataset.selected = String(Boolean(selected));
  if (selected) card.classList.add('is-selected', 'rpt-card--selected');

  const openButton = element('button', 'report-card-open rpt-card-open');
  openButton.type = 'button';
  openButton.setAttribute('aria-label', (coordinates ? 'Localizar en mapa: ' : 'Ver detalles: ') + title);
  openButton.setAttribute('aria-pressed', String(Boolean(selected)));
  openButton.addEventListener('click', () => {
    if (coordinates) {
      if (typeof onLocate === 'function') onLocate(report);
    } else if (typeof onDetails === 'function') onDetails(report);
  });

  const thumbnail = element('span', 'report-thumbnail rpt-thumbnail');
  const fallback = element('span', 'rpt-photo-fallback');
  addIcon(fallback, 'box', 24);
  fallback.appendChild(element('span', 'rpt-photo-label', 'Sin foto'));
  thumbnail.appendChild(fallback);
  const imageUrl = getReportImage(report, api);
  if (imageUrl) {
    fallback.hidden = true;
    const photo = element('img', 'rpt-card-image');
    photo.alt = '';
    photo.loading = 'lazy';
    photo.decoding = 'async';
    photo.referrerPolicy = 'no-referrer';
    photo.addEventListener('error', () => {
      photo.remove();
      fallback.hidden = false;
      thumbnail.classList.add('rpt-thumbnail--empty');
    }, { once: true });
    photo.src = imageUrl;
    thumbnail.appendChild(photo);
  } else thumbnail.classList.add('rpt-thumbnail--empty');
  openButton.appendChild(thumbnail);

  const copy = element('span', 'report-card-copy rpt-card-copy');
  copy.appendChild(element('span', 'report-card-title rpt-card-title', title));
  const badges = element('span', 'rpt-card-badges');
  badges.appendChild(element('span', 'rpt-badge rpt-badge--' + type.key, type.label));
  badges.appendChild(element('span', 'rpt-category', getReportCategory(report) || 'Sin categoría'));

  // Badge de Recompensa si existe en el reporte
  const rewardAmount = Number(report?.reward ?? report?.recompensa ?? 0);
  if (Number.isFinite(rewardAmount) && rewardAmount > 0) {
    const rewardBadge = element('span', 'rpt-badge rpt-badge--reward', '$' + rewardAmount.toLocaleString('es-MX'));
    rewardBadge.setAttribute('title', 'Recompensa ofrecida');
    rewardBadge.style.background = 'rgba(16, 185, 129, 0.18)';
    rewardBadge.style.color = '#10b981';
    rewardBadge.style.fontWeight = '700';
    badges.appendChild(rewardBadge);
  }

  copy.appendChild(badges);
  const dateLabel = getReportDate(report);
  if (dateLabel) {
    const date = element('time', 'rpt-card-date', dateLabel);
    date.dateTime = getReportDateISO(report);
    copy.appendChild(date);
  }
  const location = element('span', 'rpt-card-location');
  addIcon(location, 'pin', 13);
  location.appendChild(element('span', 'rpt-card-location-label', distanceLabel(distanceMeters)
    || (coordinates ? 'Ubicación en el mapa' : 'Ubicación no disponible')));
  copy.appendChild(location);
  openButton.appendChild(copy);
  const arrow = element('span', 'report-card-arrow rpt-card-arrow');
  addIcon(arrow, 'arrow', 17);
  openButton.appendChild(arrow);
  card.appendChild(openButton);

  const footer = element('div', 'rpt-card-footer');
  if (isOwner) {
    const own = element('span', 'rpt-own');
    addIcon(own, 'user', 12);
    own.appendChild(element('span', '', 'Tu reporte'));
    footer.appendChild(own);
  }

  // Medalla de honor del usuario en el pie si viene en la respuesta
  const authorHonor = Number(report?.user_honor ?? report?.honor_points ?? 0);
  if (authorHonor > 0) {
    const honorBadge = element('span', 'rpt-honor');
    addIcon(honorBadge, 'shield', 12);
    honorBadge.appendChild(element('span', '', authorHonor + ' pts'));
    honorBadge.style.fontSize = '0.75rem';
    honorBadge.style.color = '#6366f1';
    footer.appendChild(honorBadge);
  }

  const detailsButton = element('button', 'rpt-details', 'Ver detalles');
  detailsButton.type = 'button';
  detailsButton.setAttribute('aria-label', 'Ver detalles: ' + title);
  detailsButton.addEventListener('click', () => {
    if (typeof onDetails === 'function') onDetails(report);
  });
  footer.appendChild(detailsButton);

  if (isOwner && validIdentifier(report?.id)) {
    const deleteButton = element('button', 'report-delete rpt-delete');
    deleteButton.type = 'button';
    deleteButton.title = 'Eliminar reporte';
    deleteButton.setAttribute('aria-label', 'Eliminar reporte: ' + title);
    addIcon(deleteButton, 'trash', 16);
    deleteButton.addEventListener('click', () => {
      if (typeof onDelete === 'function') onDelete(report.id);
    });
    footer.appendChild(deleteButton);
  }
  card.appendChild(footer);
  return card;
};