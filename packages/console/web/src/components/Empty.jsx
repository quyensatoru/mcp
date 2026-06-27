// Reusable empty-state.
//  tone: 'light' (default, on paper) | 'dark' (on the IDE)
//  iconTone: '' (accent wash) | 'heat' (brand gradient)
//  inline: true => sits inside a page (auto height) instead of filling the viewport
export default function Empty({
    icon,
    title,
    hint,
    tone = 'light',
    iconTone = '',
    inline = false,
    children,
}) {
    return (
        <div className={`empty ${tone}${inline ? ' inline' : ''}`}>
            {icon && <div className={`empty-ic ${iconTone}`}>{icon}</div>}
            <div className="empty-title">{title}</div>
            {hint && <div className="empty-hint">{hint}</div>}
            {children}
        </div>
    );
}

// Common icons so pages don't re-declare SVG paths.
export const ICON = {
    folder: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
    ),
    file: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
            <path d="M14 3v4h4" />
        </svg>
    ),
    chat: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M4 5h16v11H9l-4 3v-3H4z" strokeLinejoin="round" />
        </svg>
    ),
    subagents: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="8" cy="8" r="3" />
            <circle cx="16" cy="16" r="3" />
            <path d="M8 11v2M11 8h2" />
        </svg>
    ),
    mcp: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
    ),
    lock: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
    ),
};
