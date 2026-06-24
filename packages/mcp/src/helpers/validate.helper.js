// Parse 'YYYY-MM-DD' (hoặc ISO) → Date. Trả null nếu rỗng.
export function parseDate(value) {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(d.getTime())) throw new Error(`Invalid date: ${value}`);
    return d;
}

// Build filter { $gte, $lte } cho field thời gian. `to` dạng date-only được đẩy tới cuối ngày.
export function dateRangeFilter(from, to) {
    const range = {};
    if (from) range.$gte = parseDate(from);
    if (to) range.$lte = parseDate(to.length === 10 ? `${to}T23:59:59.999Z` : to);
    return Object.keys(range).length ? range : null;
}
