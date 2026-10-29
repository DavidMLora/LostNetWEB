/** Shared report presentation helpers. They never create identifiers for API requests. */
export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

const iconPaths = {
  box: '<path d="m12 3 9 5v9l-9 5-9-5V8l9-5Zm0 10v9M3 8l9 5 9-5M7.5 5.5l9 5"/>',
  pin: '<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  message: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-1 1V11.5a9 9 0 0 1 18 0Z"/><path d="M7 10h10M7 14h6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  car: '<path d="m5 7 2-4h10l2 4 2 4v7H3v-7l2-4ZM5 7h14M3 12h18M6 18v3m12-3v3"/><circle cx="7" cy="14.5" r=".5"/><circle cx="17" cy="14.5" r=".5"/>',
  walk: '<circle cx="14" cy="4" r="2"/><path d="m7 21 4-7m5 7-3-9 1-5m-6 5 3-5 3 1 4 4h3M9 16l-3-2"/>',
  photo: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 6.1A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.9 5.9"/>'
};

/** Only this static icon table is interpolated into SVG markup. */
export const icon = (name, size = 18) => {
  const dimension = typeof size === 'number' && Number.isFinite(size) && size > 0
    ? Math.min(96, Math.max(8, size)) : 18;
  const paths = Object.hasOwn(iconPaths, name) ? iconPaths[name] : iconPaths.box;
  return '<svg width="' + dimension + '" height="' + dimension
    + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'
    + paths + '</svg>';
};

const nonblankString = (value) => typeof value === 'string' ? value.trim() : '';
const finiteNumber = (value) => {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const getReportTitle = (report) => {
  for (const value of [report?.description, report?.desc_short, report?.descripcion]) {
    const title = nonblankString(value);
    if (title) return title;
  }
  return 'Sin descripción';
};

export const getReportType = (report) => {
  if (report?.status === 'LOST') return { key: 'lost', label: 'Perdido' };
  if (report?.status === 'FOUND') return { key: 'found', label: 'Encontrado' };
  return { key: 'unknown', label: 'Tipo no indicado' };
};

export const getReportCoordinates = (report) => {
  const coordinate = (values, maximum) => {
    for (const value of values) {
      const number = finiteNumber(value);
      if (number !== null && Math.abs(number) <= maximum) return number;
    }
    return null;
  };
  const lat = coordinate([report?.latitude, report?.lat], 90);
  const lon = coordinate([report?.longitude, report?.lon], 180);
  return lat === null || lon === null ? null : { lat, lon };
};

export const getReportCategory = (report) => nonblankString(report?.category);

/** Reject calendar overflow before interpreting any explicitly zoned date. */
const validUTCDate = (year, month, day, hour, minute, second, millisecond = 0) => {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, millisecond);
  return Number.isFinite(date.getTime())
    && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day && date.getUTCHours() === hour
    && date.getUTCMinutes() === minute && date.getUTCSeconds() === second
    && date.getUTCMilliseconds() === millisecond ? date : null;
};

/** Only epoch seconds and explicit GMT/ISO-zone formats are supported, never local date guesses. */
const parseReportDateValue = (value, { epoch = true, zoned = true } = {}) => {
  if (epoch) {
    const seconds = finiteNumber(value);
    if (seconds !== null) {
      if (seconds <= 0) return null;
      const date = new Date(seconds * 1000);
      return Number.isFinite(date.getTime()) ? date : null;
    }
  }
  if (!zoned || typeof value !== 'string') return null;
  const text = value.trim();
  const rfc = text.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT$/i);
  if (rfc) {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const date = validUTCDate(Number(rfc[4]), months.indexOf(rfc[3].toLowerCase()) + 1,
      Number(rfc[2]), Number(rfc[5]), Number(rfc[6]), Number(rfc[7]));
    const weekdays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    return date && weekdays[date.getUTCDay()] === rfc[1].toLowerCase() ? date : null;
  }
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|([+-])(\d{2}):?(\d{2}))$/i);
  if (!iso) return null;
  const milliseconds = Number((iso[7] || '').padEnd(3, '0'));
  const date = validUTCDate(Number(iso[1]), Number(iso[2]), Number(iso[3]),
    Number(iso[4]), Number(iso[5]), Number(iso[6] || 0), milliseconds);
  if (!date) return null;
  if (iso[8].toUpperCase() === 'Z') return date;
  const hours = Number(iso[10]), minutes = Number(iso[11]);
  if (hours > 23 || minutes > 59) return null;
  const offset = (hours * 60 + minutes) * (iso[9] === '+' ? 1 : -1);
  const adjusted = new Date(date.getTime() - offset * 60000);
  return Number.isFinite(adjusted.getTime()) ? adjusted : null;
};

const formatParsedDate = (date, options = {}) => {
  if (!date) return '';
  const format = { day: 'numeric', month: 'short', year: 'numeric' };
  if (options?.time) Object.assign(format, { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleString('es-MX', format);
};

/** Comment timestamps remain epoch seconds; explicitly zoned text is also safe to display. */
export const formatReportDate = (timestamp, options = {}) => formatParsedDate(parseReportDateValue(timestamp), options);

const resolveReportDate = (report) => parseReportDateValue(report?.timestamp, { zoned: false })
  || parseReportDateValue(report?.created_at, { epoch: false });

/** Prefer a valid epoch timestamp, otherwise use the server's explicitly zoned created_at. */
export const getReportDate = (report, options = {}) => formatParsedDate(resolveReportDate(report), options);

export const getReportDateISO = (report) => resolveReportDate(report)?.toISOString() || '';

/** Days remaining in the ten-day report retention period; null when creation time is unknown. */
export const getReportDaysRemaining = (report, now = Date.now()) => {
  const createdAt = resolveReportDate(report)?.getTime();
  if (!Number.isFinite(createdAt)) return null;
  const retentionEndsAt = createdAt + 10 * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((retentionEndsAt - now) / (24 * 60 * 60 * 1000)));
};

export const getLocationLabel = (report) => {
  const coordinates = getReportCoordinates(report);
  return coordinates ? coordinates.lat.toFixed(5) + ', ' + coordinates.lon.toFixed(5) : '';
};

export const maskPublicEmail = (value) => {
  const email = nonblankString(value);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '';
  if (email.includes('*')) return email;
  const [name, domain] = email.split('@');
  return name.slice(0, 2) + '***@' + domain;
};

const reportPhotoPath = (report) => nonblankString(report?.photo_url) || nonblankString(report?.imagen_url);

export const getReportImage = (report, api) => {
  const path = reportPhotoPath(report);
  if (!path) return '';
  try {
    const resolved = typeof api?.resolveUrl === 'function' ? api.resolveUrl(path) : path;
    if (typeof resolved !== 'string') return '';
    const url = new URL(resolved);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
};

export const getWhatsAppLink = (report) => {
  const value = report?.phone;
  if (typeof value !== 'string' && !(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)) return '';
  const phone = String(value).trim();
  if (!/^\+?[\d\s().-]+$/.test(phone)) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return '';
  const message = 'Hola, vi tu reporte de “' + getReportTitle(report)
    + '” en LostNet. Quisiera ponerme en contacto contigo sobre este objeto.';
  return 'https://wa.me/' + digits + '?text=' + encodeURIComponent(message);
};

const validIdentifier = (id) => (typeof id === 'string' && id.trim() !== '')
  || (typeof id === 'number' && Number.isFinite(id));

/** Stable keys are for local presentation only; never substitute them for report.id. */
export const getReportKey = (report) => {
  if (validIdentifier(report?.id)) return 'id:' + String(report.id).trim();
  return 'local:' + JSON.stringify({
    coordinates: getReportCoordinates(report),
    title: getReportTitle(report),
    category: getReportCategory(report),
    status: typeof report?.status === 'string' ? report.status : '',
    photoUrl: reportPhotoPath(report)
  });
};

/** First occurrence wins so the marker and its card can share the same report data. */
export const uniqueReports = (reports) => {
  if (!Array.isArray(reports)) return [];
  const seen = new Set();
  return reports.filter((report) => {
    if (!report || typeof report !== 'object' || Array.isArray(report)) return false;
    const key = getReportKey(report);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};


