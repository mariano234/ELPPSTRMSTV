import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV } from '../shared/csv.js';

test('CSV supports empty quoted cells, commas, escaped quotes and embedded newlines', () => {
  assert.deepEqual(parseCSV('"Título","Año","Idioma"\r\n"Una, película","","es"\r\n"Dice ""hola""\nsegunda línea",2026,'), [
    ['Título', 'Año', 'Idioma'], ['Una, película', '', 'es'], ['Dice "hola"\nsegunda línea', '2026', ''],
  ]);
  assert.deepEqual(parseCSV('a,b,'), [['a', 'b', '']]);
  assert.deepEqual(parseCSV(''), []);
  assert.throws(() => parseCSV('"unfinished'), /sin cerrar/);
});
