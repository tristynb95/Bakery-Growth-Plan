/**
 * Parses a date string in UK format (d/m/y) into a Date object.
 * Handles various separators and month formats.
 * @param {string} str - The date string to parse.
 * @returns {Date|null} The parsed Date object or null if invalid.
 */
export function parseUkDate(str) {
    if (!str || str.trim() === '') return null;
    const dateRegex = /^\s*(\d{1,2})[\s\/-](\d{1,2}|[a-zA-Z]{3})[\s\/-](\d{2}|\d{4})\s*$/;
    const match = str.trim().match(dateRegex);
    if (!match) return null;
    let [, day, month, year] = match;
    day = parseInt(day, 10);
    year = parseInt(year, 10);
    if (year < 100) { year += 2000; }
    if (isNaN(month)) {
        const monthMap = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
        month = monthMap[month.toLowerCase()];
        if (month === undefined) return null;
    } else {
        month = parseInt(month, 10) - 1;
    }
    const date = new Date(Date.UTC(year, month, day));
    if (date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day) {
        return date;
    }
    return null;
}
