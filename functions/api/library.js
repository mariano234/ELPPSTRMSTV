export async function onRequest(context) {
  const SHEET_ID = "104RB6GK9_m_nzIakTU3MJLaDJPwt9fYmfHF3ikyixFE";
  
  // 1. Configuramos el sistema de caché de Cloudflare
  const cacheUrl = new URL(context.request.url);
  const cacheKey = new Request(cacheUrl.toString(), context.request);
  const cache = caches.default;

  // 2. Comprobamos si ya tenemos una versión reciente (menos de 1 hora)
  let response = await cache.match(cacheKey);
  if (response) {
      return response;
  }

  try {
      // 3. Si no hay caché, descargamos de Google Sheets
      const res = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`);
      const csvText = await res.text();

      // Función parseCSV trasladada al backend
      const parseCSV = (text) => {
          const rows = []; let row = []; let current = ''; let inQuotes = false;
          for (let i = 0; i < text.length; i++) {
              const char = text[i];
              if (char === '"' && text[i + 1] === '"') { current += '"'; i++; }
              else if (char === '"') { inQuotes = !inQuotes; }
              else if (char === ',' && !inQuotes) { row.push(current); current = ''; }
              else if (char === '\n' && !inQuotes) { row.push(current); rows.push(row); row = []; current = ''; }
              else if (char !== '\r') { current += char; }
          }
          if (current !== '' || text[text.length - 1] === ',') row.push(current);
          if (row.length > 0) rows.push(row);
          return rows;
      };

      const parsedData = parseCSV(csvText);
      const headerRowIdx = parsedData.findIndex(row => row.some(c => typeof c === 'string' && (c.toLowerCase().includes('título') || c.toLowerCase().includes('title'))));
      const validHeaderIdx = headerRowIdx !== -1 ? headerRowIdx : 0;
      
      const headers = parsedData[validHeaderIdx].map(h => (h || '').toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
      const getIdx = (keys) => headers.findIndex(h => keys.some(k => h.includes(k)));
      
      const idxTitle = getIdx(['titulo', 'title']);
      const idxYear = getIdx(['ano', 'year', 'año']);
      const idxLang = getIdx(['idioma', 'lenguaje']);
      const idxQual = getIdx(['calidad']);
      const idxGen  = getIdx(['genero', 'género']);
      
      let idxLink = getIdx(['lnkf']);
      if (idxLink === -1) idxLink = getIdx(['link final', 'url final', 'descarga']);

      const rawRows = parsedData.slice(validHeaderIdx + 1).filter(r => r[idxTitle]);

      // 4. Formatear y preparar los datos
      const items = rawRows.map(row => {
          let rawLink = '';
          if (idxLink !== -1 && row[idxLink] && typeof row[idxLink] === 'string' && row[idxLink].trim().includes('http')) {
              rawLink = row[idxLink]; 
          } else {
              const cellHttp = [...row].reverse().find(c => c && typeof c === 'string' && (c.trim().includes('http') || c.trim().includes('www.')));
              if (cellHttp) rawLink = cellHttp;
          }
          let finalLink = rawLink.trim();
          if (!finalLink || finalLink.toLowerCase() === 'link' || finalLink.toLowerCase() === 'lnkf') finalLink = '#';
          else if (finalLink !== '#' && !finalLink.startsWith('http')) finalLink = 'https://' + finalLink;

          return {
              title: row[idxTitle],
              year: row[idxYear] || '?',
              quality: idxQual !== -1 ? row[idxQual] : '',
              language: idxLang !== -1 ? row[idxLang] : 'N/A',
              rawGenre: idxGen !== -1 ? row[idxGen] : null,
              link: finalLink
          };
      });

      // 5. Preparamos la respuesta indicando que debe cachearse 3600 segundos (1 hora)
      const jsonResponse = new Response(JSON.stringify(items), {
          headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, s-maxage=3600, max-age=3600",
              "Access-Control-Allow-Origin": "*"
          }
      });

      // Guardamos en la caché de Cloudflare para futuras peticiones
      context.waitUntil(cache.put(cacheKey, jsonResponse.clone()));
      
      return jsonResponse;

  } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { 
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
      });
  }
}