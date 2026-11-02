import { describe, it, expect } from 'vitest';
import {
  escapeHtml, icon, getReportTitle, getReportType, getReportCoordinates,
  getReportCategory, getReportDateISO, getReportDate, formatReportDate,
  getReportDaysRemaining, getLocationLabel, maskPublicEmail, getReportImage,
  getWhatsAppLink, getReportKey, uniqueReports
} from '../../src/scripts/reports-utils.js';

const created = { created_at: 'Wed, 21 Oct 2026 15:16:20 GMT' };

describe('Report presentation and privacy', () => {
  it('escapes markup, attribute delimiters and ampersands', () => {
    expect(escapeHtml(`<img title="a&b">'`)).toBe('&lt;img title=&quot;a&amp;b&quot;&gt;&#39;');
    expect(escapeHtml(null)).toBe('');
  });
  it('selects the first nonblank description and trims it', () => {
    expect(getReportTitle({ description: ' ', desc_short: ' Llaves ', descripcion: 'Otra' })).toBe('Llaves');
  });
  it('does not invent a description for absent or invalid fields', () => {
    expect(getReportTitle(null)).toBe('Sin descripción');
    expect(getReportTitle({ description: 42 })).toBe('Sin descripción');
  });
  it('distinguishes lost and found without guessing unknown states', () => {
    expect(getReportType({ status: 'LOST' })).toEqual({ key: 'lost', label: 'Perdido' });
    expect(getReportType({ status: 'FOUND' })).toEqual({ key: 'found', label: 'Encontrado' });
    expect(getReportType({ status: 'OTHER' }).key).toBe('unknown');
  });
  it('keeps an actual category and leaves missing data empty', () => {
    expect(getReportCategory({ category: ' Ropa ' })).toBe('Ropa');
    expect(getReportCategory(null)).toBe('');
  });
  it('masks a public email without changing its domain', () => {
    expect(maskPublicEmail('persona@example.test')).toBe('pe***@example.test');
  });
  it('does not mask an already masked email again', () => {
    expect(maskPublicEmail('p***@example.test')).toBe('p***@example.test');
  });
  it('rejects missing and malformed contact emails', () => {
    for (const email of [null, '', 'not-an-email', 'a b@host.test', 42]) expect(maskPublicEmail(email)).toBe('');
  });
  it('uses only a static icon and bounded dimensions for untrusted names', () => {
    const result = icon('<script>', 500);
    expect(result).toContain('width="96"');
    expect(result).not.toContain('<script>');
    expect(icon('box', -2)).toContain('width="18"');
  });
});

describe('Coordinates and map data', () => {
  it('accepts string coordinates and legacy aliases', () => {
    expect(getReportCoordinates({ latitude: '21.88', longitude: '-102.29' })).toEqual({ lat: 21.88, lon: -102.29 });
    expect(getReportCoordinates({ lat: 4, lon: -5 })).toEqual({ lat: 4, lon: -5 });
  });
  it('retains valid zero coordinates and boundary values', () => {
    expect(getReportCoordinates({ lat: 0, lon: 0 })).toEqual({ lat: 0, lon: 0 });
    expect(getReportCoordinates({ lat: -90, lon: 180 })).toEqual({ lat: -90, lon: 180 });
  });
  it('rejects empty, nonnumeric and out-of-range coordinates', () => {
    for (const report of [null, {}, { lat: true, lon: 2 }, { lat: '', lon: 2 }, { lat: Infinity, lon: 2 }, { lat: 91, lon: 0 }, { lat: 0, lon: -181 }]) {
      expect(getReportCoordinates(report)).toBeNull();
    }
  });
  it('formats a real location and omits missing coordinates', () => {
    expect(getLocationLabel({ lat: 0, lon: -102.29 })).toBe('0.00000, -102.29000');
    expect(getLocationLabel({})).toBe('');
  });
  it('deduplicates numeric/string IDs, retaining the first record', () => {
    const first = { id: 7, description: 'Original' };
    expect(uniqueReports([first, { id: '7', description: 'Duplicate' }, { id: 8 }])).toEqual([first, { id: 8 }]);
  });
  it('uses ID zero and stable local keys without mutating missing IDs', () => {
    const report = { description: 'Bolsa', lat: 0, lon: 1 };
    expect(getReportKey({ id: 0 })).toBe('id:0');
    expect(getReportKey(report)).toBe(getReportKey({ ...report }));
    expect(getReportKey(report)).toMatch(/^local:/);
    expect(report).not.toHaveProperty('id');
  });
  it('rejects non-array collections and invalid rows', () => {
    expect(uniqueReports(null)).toEqual([]);
    expect(uniqueReports([null, [], false, 'report', { id: 1 }])).toEqual([{ id: 1 }]);
  });
});

describe('Real server dates and ten-day retention', () => {
  it('parses the server GMT creation date independently of locale', () => {
    expect(getReportDateISO(created)).toBe('2026-10-21T15:16:20.000Z');
    expect(getReportDate(created)).not.toBe('');
  });
  it('prefers an epoch timestamp over created_at', () => {
    expect(getReportDateISO({ ...created, timestamp: 1 })).toBe('1970-01-01T00:00:01.000Z');
  });
  it('normalizes an explicitly zoned ISO date', () => {
    expect(getReportDateISO({ created_at: '2026-10-21T09:16:20-06:00' })).toBe('2026-10-21T15:16:20.000Z');
  });
  it('rejects calendar overflow, wrong weekdays and ambiguous local dates', () => {
    for (const value of ['2026-02-30T10:00:00Z', 'Tue, 21 Oct 2026 15:16:20 GMT', '2026-10-21', '2026-10-21T10:00:00', 'invalid']) {
      expect(getReportDateISO({ created_at: value })).toBe('');
    }
  });
  it('does not use expiry as a creation date or invent a current date', () => {
    expect(getReportDateISO({ expires_at_epoch: 1793450000 })).toBe('');
    expect(getReportDate(null)).toBe('');
    expect(formatReportDate(0)).toBe('');
    expect(formatReportDate(null)).toBe('');
  });
  it('counts the ten-day retention period with partial days rounded up', () => {
    const start = Date.parse('2026-10-21T15:16:20Z');
    expect(getReportDaysRemaining(created, start)).toBe(10);
    expect(getReportDaysRemaining(created, start + 9.5 * 86400000)).toBe(1);
  });
  it('returns zero at/after expiry and null for an unknown creation time', () => {
    expect(getReportDaysRemaining(created, Date.parse('2026-11-01T00:00:00Z'))).toBe(0);
    expect(getReportDaysRemaining({})).toBeNull();
  });
});

describe('Photo and WhatsApp URLs', () => {
  const api = { resolveUrl: (path) => 'https://photos.example.test' + path };
  it('resolves relative image paths through the actual API resolver', () => {
    expect(getReportImage({ photo_url: '/photos/a.jpg' }, api)).toBe('https://photos.example.test/photos/a.jpg');
  });
  it('accepts legacy image aliases and existing HTTPS URLs', () => {
    expect(getReportImage({ imagen_url: 'https://photos.example.test/a.jpg' })).toBe('https://photos.example.test/a.jpg');
  });
  it('rejects unsafe image protocols and absent images', () => {
    expect(getReportImage({ photo_url: 'javascript:alert(1)' })).toBe('');
    expect(getReportImage({ photo_url: 'data:image/png;base64,a' })).toBe('');
    expect(getReportImage(null)).toBe('');
  });
  it('normalizes an existing public number and URL-encodes object text', () => {
    const url = new URL(getWhatsAppLink({ phone: '+52 (449) 123-4567', description: 'Llaves & bolsa' }));
    expect(url.origin + url.pathname).toBe('https://wa.me/524491234567');
    expect(url.searchParams.get('text')).toContain('Llaves & bolsa');
  });
  it('does not invent an international prefix', () => {
    expect(new URL(getWhatsAppLink({ phone: '4491234567' })).pathname).toBe('/4491234567');
  });
  it('hides malformed, too short, too long and absent phone numbers', () => {
    for (const phone of [null, '', '123', '1234567890123456', '4491234<script>', true, 'number']) expect(getWhatsAppLink({ phone })).toBe('');
  });
});
