export async function onRequest(context) {
    const SHEET_ID = "104RB6GK9_m_nzIakTU3MJLaDJPwt9fYmfHF3ikyixFE";
    const cache = caches.default;
    const cacheKey = new Request(context.request.url);

    let response = await cache.match(cacheKey);
    if (response) {
        return response;
    }

    try {
        const res = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`);
        if (!res.ok) throw new Error("Fallo en la conexión con el origen de datos.");

        const csvText = await res.text();

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
        let idxLink = getIdx(['lnkf', 'link final', 'url final', 'descarga']);

        const rawRows = parsedData.slice(validHeaderIdx + 1).filter(r => r[idxTitle]);

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
                title: row[idxTitle].trim(),
                year: row[idxYear] ? row[idxYear].trim() : '?',
                quality: idxQual !== -1 && row[idxQual] ? row[idxQual].trim() : '',
                language: idxLang !== -1 && row[idxLang] ? row[idxLang].trim() : 'N/A',
                link: finalLink
            };
        });

        const jsonResponse = new Response(JSON.stringify(items), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=3600, s-maxage=3600"
            }
        });

        context.waitUntil(cache.put(cacheKey, jsonResponse.clone()));
        return jsonResponse;

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
}