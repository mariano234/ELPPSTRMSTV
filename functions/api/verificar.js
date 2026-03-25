export async function onRequest(context) {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
    };
    
    try {
        // Tu ID de Google Sheets
        const SHEET_ID = "104RB6GK9_m_nzIakTU3MJLaDJPwt9fYmfHF3ikyixFE";
        const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Peliculas`;
        
        const res = await fetch(CSV_URL);
        if (!res.ok) throw new Error("Fallo al descargar el CSV de Google");
        
        const csvText = await res.text();
        
        // Función ultra-robusta para leer CSV
        const rows = [];
        let row = [];
        let inQuotes = false;
        let value = '';
        for (let i = 0; i < csvText.length; i++) {
            const char = csvText[i];
            if (char === '"') {
                if (inQuotes && csvText[i+1] === '"') { value += '"'; i++; }
                else { inQuotes = !inQuotes; }
            } else if (char === ',' && !inQuotes) {
                row.push(value.trim()); value = '';
            } else if ((char === '\n' || char === '\r') && !inQuotes) {
                if (char === '\r' && csvText[i+1] === '\n') i++; 
                row.push(value.trim()); 
                if (row.length > 1 || row[0] !== '') rows.push(row); 
                row = []; value = '';
            } else {
                value += char;
            }
        }
        if (value || row.length > 0) { row.push(value.trim()); rows.push(row); }
        
        if (rows.length < 2) return new Response(JSON.stringify([]), { status: 200, headers: corsHeaders });
        
        // Identificar las columnas automáticamente
        const headers = rows[0].map(h => h.toLowerCase());
        const titleIdx = headers.findIndex(h => h.includes('título') || h.includes('titulo') || h === 'title');
        const yearIdx = headers.findIndex(h => h.includes('año') || h === 'year');
        const qualityIdx = headers.findIndex(h => h.includes('calidad') || h === 'quality');
        const langIdx = headers.findIndex(h => h.includes('idioma') || h === 'language');
        const genreIdx = headers.findIndex(h => h.includes('género') || h.includes('genero') || h === 'genre');
        
        // --- FIX DE LOS ENLACES ---
        // Buscamos específicamente la columna LNKF. Si no existe con ese nombre, forzamos la columna I (índice 8)
        let linkIdx = headers.findIndex(h => h === 'lnkf');
        if (linkIdx === -1) {
            linkIdx = 8; // (0=A, 1=B, 2=C... 6=G, 7=H, 8=I)
        }

        const items = [];
        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i];
            if (!cols || cols.length < 2) continue;
            
            // Transformar todo a un JSON unificado
            items.push({
                title: titleIdx >= 0 ? cols[titleIdx] : '',
                year: yearIdx >= 0 ? cols[yearIdx] : '',
                quality: qualityIdx >= 0 ? cols[qualityIdx] : '',
                language: langIdx >= 0 ? cols[langIdx] : '',
                link: linkIdx >= 0 && cols[linkIdx] ? cols[linkIdx] : '',
                rawGenre: genreIdx >= 0 ? cols[genreIdx] : ''
            });
        }

        return new Response(JSON.stringify(items), { status: 200, headers: corsHeaders });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
}