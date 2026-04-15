'use strict';

// Mapowanie typ → kolor markera
const TYP_KOLOR = { DP: '#e74c3c', RP: '#3498db', MP: '#f1c40f' };

// Kolumny wykluczone z widoku tabeli i wyszukiwania globalnego
const HIDDEN_COLS = new Set(['tekst', 'x', 'y', 'kolor']);

// Przyjazne nazwy kolumn
const COL_LABELS = {
  numer: 'Nr',
  typ: 'Typ',
  rok_budowy: 'Rok budowy',
  wielkosc: 'Wielkość (m²)'
};

/**
 * Buduje ujednolicony łańcuch tekstowy do wyszukiwania pełnotekstowego.
 * Uwzględnia tylko pola z wartością (pomija falsy oprócz 0 dla x/y).
 * @param {object} d - Obiekt domku
 * @returns {string}
 */
function buildTekst(d) {
  return [
    d.numer ? `nr ${d.numer}` : '',
    d.typ ? `typ ${d.typ}` : '',
    d.rok_budowy ? `rok ${d.rok_budowy}` : '',
    d.wielkosc ? `wielkosc ${d.wielkosc}` : '',
    d.x !== undefined && d.x !== '' ? `x ${d.x}` : '',
    d.y !== undefined && d.y !== '' ? `y ${d.y}` : ''
  ].filter(Boolean).join(' ');
}

/**
 * Normalizuje surowy obiekt domku: konwertuje typy, przypisuje kolor i tekst.
 * @param {object} obj - Surowy obiekt (np. z CSV)
 * @returns {object} - Znormalizowany obiekt domku
 */
function normalizeDomek(obj) {
  const d = { ...obj };

  d.numer = parseInt(d.numer);
  d.rok_budowy = parseInt(d.rok_budowy);
  d.wielkosc = parseFloat(d.wielkosc);
  d.x = parseFloat(d.x);
  d.y = parseFloat(d.y);
  d.tekst = buildTekst(d);
  d.kolor = TYP_KOLOR[d.typ] || '#888888';

  return d;
}

/**
 * Parsuje tekst CSV (separator `,` lub `;`) i zwraca tablicę znormalizowanych domków.
 * Wiersze z nieprawidłowym numerem (NaN) są odfiltrowane.
 * @param {string} text - Zawartość pliku CSV
 * @returns {object[]}
 */
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  // Wykryj separator: średnik (polski Excel) lub przecinek
  const firstLine = lines[0].replace(/^\uFEFF/, '');
  const sep = firstLine.includes(';') ? ';' : ',';
  const headers = firstLine.split(sep).map(h => h.trim());
  return lines.slice(1)
    .filter(l => l.trim())
    .map(line => {
      const vals = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ''));
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
      return normalizeDomek(obj);
    })
    .filter(d => !isNaN(d.numer));
}

/**
 * Konwersja współrzędnych pikselowych (0,0 = lewy-górny) → Leaflet CRS.Simple.
 * @param {number} x
 * @param {number} y
 * @param {number} imgH - Wysokość obrazu w pikselach
 * @returns {[number, number]} - [lat, lng] w układzie Leaflet CRS.Simple
 */
function px(x, y, imgH = 1098) {
  return [imgH - y, x];
}

/**
 * Oblicza współczynnik skalowania markera na podstawie poziomu zoomu.
 * Wartość jest zaciśnięta do przedziału [minZoom, maxZoom].
 * @param {number} zoom
 * @returns {string} - Liczba zmiennoprzecinkowa z 3 miejscami po przecinku
 */
function getMarkerZoomScale(zoom) {
  const minZoom = -2;
  const maxZoom = 3;
  const normalized = Math.max(0, Math.min(1, (zoom - minZoom) / (maxZoom - minZoom)));
  return (0.72 + normalized * 0.88).toFixed(3);
}

/**
 * Generuje HTML tooltipa dla domku.
 * Pomija kolumny z HIDDEN_COLS; wielkosc wyświetla z jednostką m².
 * @param {object} d - Znormalizowany obiekt domku
 * @returns {string} - HTML
 */
function buildTooltip(d) {
  const keys = Object.keys(d).filter(k => !HIDDEN_COLS.has(k));
  const rows = keys.slice(1).map(k => {
    const label = COL_LABELS[k] || k;
    const val = k === 'wielkosc' ? d[k] + ' m²' : d[k];
    return `<div class="tip-row"><span class="tip-label">${label}:</span><span class="tip-val">${val}</span></div>`;
  }).join('');
  return `<div class="tip-title">Domek nr ${d.numer}</div>${rows}`;
}

/**
 * Sprawdza, czy domek pasuje do globalnego zapytania i filtrów kolumnowych.
 * @param {object} d - Znormalizowany obiekt domku
 * @param {string} query - Globalne zapytanie tekstowe (może być '')
 * @param {object} columnFilters - Słownik {kolumna: wartość filtra}
 * @param {string[]} displayCols - Kolumny widoczne w tabeli
 * @returns {boolean}
 */
function matchesQuery(d, query, columnFilters, displayCols) {
  const lq = query ? query.toLowerCase() : '';

  const matchesGlobal = !lq || Object.entries(d)
    .filter(([k]) => !HIDDEN_COLS.has(k))
    .some(([, v]) => String(v).toLowerCase().includes(lq));

  if (!matchesGlobal) return false;

  return displayCols.every((key) => {
    const filterValue = (columnFilters[key] || '').trim().toLowerCase();
    if (!filterValue) return true;
    return String(d[key] ?? '').toLowerCase().includes(filterValue);
  });
}

module.exports = {
  TYP_KOLOR,
  HIDDEN_COLS,
  COL_LABELS,
  buildTekst,
  normalizeDomek,
  parseCSV,
  px,
  getMarkerZoomScale,
  buildTooltip,
  matchesQuery
};
