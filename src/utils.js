export const fetchTMDB = async (title, year, appLang) => {
    try {
        const url = `/api/tmdb?title=${encodeURIComponent(title)}&year=${encodeURIComponent(year)}&lang=${appLang}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
};