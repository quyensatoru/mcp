export function parseDate(value) {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(d.getTime())) throw new Error(`Invalid date: ${value}`);
    return d;
}

export function dateRangeFilter(from, to) {
    const range = {};
    if (from) range.$gte = parseDate(from);
    if (to) range.$lte = parseDate(to.length === 10 ? `${to}T23:59:59.999Z` : to);
    return Object.keys(range).length ? range : null;
}
