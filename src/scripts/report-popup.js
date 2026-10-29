import { icon, getReportTitle, getReportType, getReportCategory, getReportDate } from './reports-utils.js';

const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const button = (className, label, iconName, action) => {
  const node = element('button', className);
  node.type = 'button';
  if (iconName) node.innerHTML = icon(iconName, 15);
  node.append(document.createTextNode(label));
  node.addEventListener('click', action);
  return node;
};

/** Popup data is rendered as text; only static SVG paths are HTML. */
export const createReportPopup = (report, {
  safe = false, isOwner = false, imageUrl = '', onDetails, onDelete, onCar, onWalk
} = {}) => {
  const popup = element('div', 'rpt-popup');
  const badges = element('div', 'rpt-popup-badges');
  const type = safe ? { key: 'found', label: 'Punto seguro' } : getReportType(report);
  badges.append(element('span', 'rpt-badge rpt-badge--' + type.key, type.label));
  const category = safe ? '' : getReportCategory(report);
  if (category) badges.append(element('span', 'rpt-category', category));
  if (isOwner && !safe) badges.append(element('span', 'rpt-own', 'Tu reporte'));
  popup.append(badges);
  popup.append(element('h3', 'rpt-popup-title', safe ? report.nombre || 'Punto seguro' : getReportTitle(report)));
  const date = safe ? report.horario || '' : getReportDate(report);
  if (date) popup.append(element('p', 'rpt-popup-date', date));
  if (imageUrl) {
    const image = element('img', 'rpt-popup-image');
    image.src = imageUrl;
    image.alt = safe ? 'Foto del punto seguro' : 'Foto del objeto';
    image.referrerPolicy = 'no-referrer';
    image.onerror = () => image.remove();
    popup.append(image);
  }
  popup.append(button('rpt-popup-details', safe ? 'Más información' : 'Ver detalles y comentarios', null, () => onDetails?.()));
  const routes = element('div', 'rpt-popup-routes');
  routes.append(
    button('', 'En auto', 'car', () => onCar?.()),
    button('', 'A pie', 'walk', () => onWalk?.())
  );
  popup.append(routes);
  if (isOwner && !safe && report.id !== undefined && report.id !== null && String(report.id).trim()) {
    popup.append(button('rpt-popup-delete', 'Eliminar reporte', 'trash', () => onDelete?.(report.id)));
  }
  return popup;
};
