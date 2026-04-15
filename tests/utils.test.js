'use strict';

const {
  TYP_KOLOR,
  buildTekst,
  normalizeDomek,
  parseCSV,
  px,
  getMarkerZoomScale,
  buildTooltip,
  matchesQuery
} = require('../src/utils');

// ─────────────────────────────────────────────────────────────
//  TYP_KOLOR
// ─────────────────────────────────────────────────────────────
describe('TYP_KOLOR', () => {
  test('DP jest czerwony', () => {
    expect(TYP_KOLOR.DP).toBe('#e74c3c');
  });
  test('RP jest niebieski', () => {
    expect(TYP_KOLOR.RP).toBe('#3498db');
  });
  test('MP jest żółty', () => {
    expect(TYP_KOLOR.MP).toBe('#f1c40f');
  });
  test('zawiera dokładnie 3 typy', () => {
    expect(Object.keys(TYP_KOLOR)).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────────────
//  buildTekst
// ─────────────────────────────────────────────────────────────
describe('buildTekst', () => {
  test('buduje pełny łańcuch ze wszystkimi polami', () => {
    const d = { numer: 1, typ: 'RP', rok_budowy: 2010, wielkosc: 24, x: 408, y: 683 };
    expect(buildTekst(d)).toBe('nr 1 typ RP rok 2010 wielkosc 24 x 408 y 683');
  });

  test('pomija pola falsy (undefined, pusty łańcuch)', () => {
    const d = { numer: 5, typ: 'DP', rok_budowy: undefined, wielkosc: '', x: 100, y: 200 };
    const result = buildTekst(d);
    expect(result).not.toContain('rok');
    expect(result).not.toContain('wielkosc');
    expect(result).toContain('nr 5');
    expect(result).toContain('typ DP');
  });

  test('nie pomija x/y gdy wynoszą 0', () => {
    const d = { numer: 1, typ: 'RP', rok_budowy: 2000, wielkosc: 20, x: 0, y: 0 };
    expect(buildTekst(d)).toContain('x 0');
    expect(buildTekst(d)).toContain('y 0');
  });

  test('pomija x gdy jest pustym łańcuchem', () => {
    const d = { numer: 1, typ: 'RP', rok_budowy: 2000, wielkosc: 20, x: '', y: '' };
    expect(buildTekst(d)).not.toContain(' x ');
    expect(buildTekst(d)).not.toContain(' y ');
  });
});

// ─────────────────────────────────────────────────────────────
//  normalizeDomek
// ─────────────────────────────────────────────────────────────
describe('normalizeDomek', () => {
  const raw = { numer: '7', typ: 'MP', rok_budowy: '1992', wielkosc: '17.5', x: '535', y: '637' };

  test('konwertuje numer na integer', () => {
    expect(normalizeDomek(raw).numer).toBe(7);
  });

  test('konwertuje rok_budowy na integer', () => {
    expect(normalizeDomek(raw).rok_budowy).toBe(1992);
  });

  test('konwertuje wielkosc na float', () => {
    expect(normalizeDomek(raw).wielkosc).toBe(17.5);
  });

  test('konwertuje x i y na float', () => {
    const d = normalizeDomek(raw);
    expect(d.x).toBe(535);
    expect(d.y).toBe(637);
  });

  test('przypisuje kolor DP jako czerwony', () => {
    expect(normalizeDomek({ ...raw, typ: 'DP' }).kolor).toBe('#e74c3c');
  });

  test('przypisuje kolor RP jako niebieski', () => {
    expect(normalizeDomek({ ...raw, typ: 'RP' }).kolor).toBe('#3498db');
  });

  test('przypisuje kolor MP jako żółty', () => {
    expect(normalizeDomek(raw).kolor).toBe('#f1c40f');
  });

  test('nieznany typ otrzymuje kolor zastępczy #888888', () => {
    expect(normalizeDomek({ ...raw, typ: 'XX' }).kolor).toBe('#888888');
  });

  test('pusty typ otrzymuje kolor zastępczy #888888', () => {
    expect(normalizeDomek({ ...raw, typ: '' }).kolor).toBe('#888888');
  });

  test('buduje pole tekst', () => {
    const d = normalizeDomek(raw);
    expect(d.tekst).toContain('nr 7');
    expect(d.tekst).toContain('typ MP');
  });

  test('nie mutuje oryginalnego obiektu', () => {
    const original = { ...raw };
    normalizeDomek(raw);
    expect(raw).toEqual(original);
  });
});

// ─────────────────────────────────────────────────────────────
//  parseCSV
// ─────────────────────────────────────────────────────────────
describe('parseCSV', () => {
  const csvComma = `numer,typ,rok_budowy,wielkosc,x,y
1,RP,2010,24,408,683
2,MP,1988,16,437,622`;

  const csvSemicolon = `numer;typ;rok_budowy;wielkosc;x;y
1;RP;2010;24;408;683
2;MP;1988;16;437;622`;

  test('parsuje CSV z separatorem przecinkowym', () => {
    const result = parseCSV(csvComma);
    expect(result).toHaveLength(2);
    expect(result[0].numer).toBe(1);
    expect(result[1].numer).toBe(2);
  });

  test('parsuje CSV z separatorem średnikowym (polski Excel)', () => {
    const result = parseCSV(csvSemicolon);
    expect(result).toHaveLength(2);
    expect(result[0].typ).toBe('RP');
  });

  test('normalizuje wartości (numer jako int, wielkosc jako float)', () => {
    const result = parseCSV(csvComma);
    expect(result[0].numer).toBe(1);
    expect(result[0].wielkosc).toBe(24);
    expect(result[0].rok_budowy).toBe(2010);
  });

  test('usuwa BOM (\\uFEFF) z pierwszej linii', () => {
    const withBOM = '\uFEFF' + csvSemicolon;
    const result = parseCSV(withBOM);
    expect(result).toHaveLength(2);
    expect(result[0].numer).toBe(1);
  });

  test('zwraca pustą tablicę gdy wejście ma tylko nagłówek', () => {
    expect(parseCSV('numer,typ,rok_budowy,wielkosc,x,y')).toEqual([]);
  });

  test('zwraca pustą tablicę dla pustego łańcucha', () => {
    expect(parseCSV('')).toEqual([]);
  });

  test('filtruje wiersze z nieprawidłowym numerem (NaN)', () => {
    const csv = `numer,typ,rok_budowy,wielkosc,x,y
abc,RP,2010,24,100,200
1,DP,1980,38,50,60`;
    const result = parseCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0].numer).toBe(1);
  });

  test('ignoruje puste wiersze', () => {
    const csv = `numer,typ,rok_budowy,wielkosc,x,y
1,RP,2010,24,408,683

2,MP,1988,16,437,622
`;
    expect(parseCSV(csv)).toHaveLength(2);
  });

  test('obsługuje zakończenia linii Windows (\\r\\n)', () => {
    const csv = 'numer,typ,rok_budowy,wielkosc,x,y\r\n1,RP,2010,24,408,683\r\n2,MP,1988,16,437,622';
    expect(parseCSV(csv)).toHaveLength(2);
  });

  test('usuwa cudzysłowy otaczające wartości', () => {
    const csv = `numer,typ,rok_budowy,wielkosc,x,y
"1","RP","2010","24","408","683"`;
    const result = parseCSV(csv);
    expect(result[0].numer).toBe(1);
    expect(result[0].typ).toBe('RP');
  });

  test('przypisuje kolory na podstawie typu', () => {
    const result = parseCSV(csvComma);
    expect(result[0].kolor).toBe('#3498db'); // RP
    expect(result[1].kolor).toBe('#f1c40f'); // MP
  });
});

// ─────────────────────────────────────────────────────────────
//  px – konwersja współrzędnych
// ─────────────────────────────────────────────────────────────
describe('px', () => {
  const IMG_H = 1098;

  test('zwraca [IMG_H - y, x]', () => {
    expect(px(100, 200, IMG_H)).toEqual([898, 100]);
  });

  test('górny lewy narożnik (0,0) mapuje na [IMG_H, 0]', () => {
    expect(px(0, 0, IMG_H)).toEqual([IMG_H, 0]);
  });

  test('dolny prawy narożnik mapuje na [0, IMG_W]', () => {
    const IMG_W = 755;
    expect(px(IMG_W, IMG_H, IMG_H)).toEqual([0, IMG_W]);
  });

  test('używa domyślnej wysokości obrazu 1098 gdy imgH pominięty', () => {
    expect(px(50, 100)).toEqual([998, 50]);
  });
});

// ─────────────────────────────────────────────────────────────
//  getMarkerZoomScale
// ─────────────────────────────────────────────────────────────
describe('getMarkerZoomScale', () => {
  test('przy minZoom (-2) zwraca 0.720', () => {
    expect(getMarkerZoomScale(-2)).toBe('0.720');
  });

  test('przy maxZoom (3) zwraca 1.600', () => {
    expect(getMarkerZoomScale(3)).toBe('1.600');
  });

  test('wartości poniżej minZoom są zaciśnięte do 0.720', () => {
    expect(getMarkerZoomScale(-99)).toBe('0.720');
  });

  test('wartości powyżej maxZoom są zaciśnięte do 1.600', () => {
    expect(getMarkerZoomScale(99)).toBe('1.600');
  });

  test('zoom = 0.5 daje wartość pomiędzy skrajnymi', () => {
    const scale = parseFloat(getMarkerZoomScale(0.5));
    expect(scale).toBeGreaterThan(0.72);
    expect(scale).toBeLessThan(1.60);
  });

  test('wynik ma dokładnie 3 miejsca po przecinku', () => {
    expect(getMarkerZoomScale(1)).toMatch(/^\d+\.\d{3}$/);
  });

  test('skala rośnie monotonicznie ze wzrostem zoomu', () => {
    const s1 = parseFloat(getMarkerZoomScale(-1));
    const s2 = parseFloat(getMarkerZoomScale(0));
    const s3 = parseFloat(getMarkerZoomScale(1));
    expect(s1).toBeLessThan(s2);
    expect(s2).toBeLessThan(s3);
  });
});

// ─────────────────────────────────────────────────────────────
//  buildTooltip
// ─────────────────────────────────────────────────────────────
describe('buildTooltip', () => {
  const domek = normalizeDomek({ numer: '4', typ: 'DP', rok_budowy: '1978', wielkosc: '38', x: '474', y: '665' });

  test('zawiera tytuł z numerem domku', () => {
    expect(buildTooltip(domek)).toContain('Domek nr 4');
  });

  test('zawiera typ', () => {
    expect(buildTooltip(domek)).toContain('DP');
  });

  test('wielkosc jest wyświetlana z jednostką m²', () => {
    expect(buildTooltip(domek)).toContain('38 m²');
  });

  test('nie zawiera ukrytych kolumn (x, y, kolor, tekst)', () => {
    const html = buildTooltip(domek);
    // Kolumny ukryte nie powinny pojawiać się jako etykiety
    expect(html).not.toContain('tip-label">x:');
    expect(html).not.toContain('tip-label">y:');
    expect(html).not.toContain('tip-label">kolor:');
    expect(html).not.toContain('tip-label">tekst:');
  });

  test('zwraca prawidłowy HTML z klasami tip-row', () => {
    expect(buildTooltip(domek)).toContain('class="tip-row"');
  });
});

// ─────────────────────────────────────────────────────────────
//  matchesQuery
// ─────────────────────────────────────────────────────────────
describe('matchesQuery', () => {
  const domek = normalizeDomek({ numer: '12', typ: 'DP', rok_budowy: '1977', wielkosc: '39', x: '580', y: '614' });
  const displayCols = ['numer', 'typ', 'rok_budowy', 'wielkosc'];

  test('puste zapytanie i brak filtrów → true', () => {
    expect(matchesQuery(domek, '', {}, displayCols)).toBe(true);
  });

  test('globalne wyszukiwanie – trafienie po numerze', () => {
    expect(matchesQuery(domek, '12', {}, displayCols)).toBe(true);
  });

  test('globalne wyszukiwanie – trafienie po typie', () => {
    expect(matchesQuery(domek, 'dp', {}, displayCols)).toBe(true);
  });

  test('globalne wyszukiwanie jest nieczułe na wielkość liter', () => {
    expect(matchesQuery(domek, 'DP', {}, displayCols)).toBe(true);
    expect(matchesQuery(domek, 'dp', {}, displayCols)).toBe(true);
  });

  test('globalne wyszukiwanie – brak trafienia', () => {
    expect(matchesQuery(domek, 'xyz', {}, displayCols)).toBe(false);
  });

  test('filtr kolumnowy – trafienie dokładne', () => {
    expect(matchesQuery(domek, '', { typ: 'DP' }, displayCols)).toBe(true);
  });

  test('filtr kolumnowy – częściowe dopasowanie (podłańcuch)', () => {
    expect(matchesQuery(domek, '', { rok_budowy: '197' }, displayCols)).toBe(true);
  });

  test('filtr kolumnowy jest nieczuły na wielkość liter', () => {
    expect(matchesQuery(domek, '', { typ: 'dp' }, displayCols)).toBe(true);
  });

  test('filtr kolumnowy – brak trafienia', () => {
    expect(matchesQuery(domek, '', { typ: 'RP' }, displayCols)).toBe(false);
  });

  test('kombinacja: globalne + filtr kolumnowy oba muszą pasować', () => {
    expect(matchesQuery(domek, '12', { typ: 'DP' }, displayCols)).toBe(true);
    expect(matchesQuery(domek, '12', { typ: 'RP' }, displayCols)).toBe(false);
  });

  test('ukryte kolumny (x, y) nie są przeszukiwane globalnie', () => {
    // x=580, y=614 – wartości nie powinny dawać trafień przez globalne wyszukiwanie
    // ponieważ HIDDEN_COLS wyklucza te pola
    const result = matchesQuery(domek, '580', {}, displayCols);
    expect(result).toBe(false);
  });

  test('pusty filtr kolumnowy traktowany jako brak filtra', () => {
    expect(matchesQuery(domek, '', { typ: '' }, displayCols)).toBe(true);
    expect(matchesQuery(domek, '', { typ: '   ' }, displayCols)).toBe(true);
  });
});
