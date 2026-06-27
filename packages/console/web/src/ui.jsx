import { useMemo, useState } from 'react';

export function Card({ title, desc, actions, children }) {
    return (
        <div className="card">
            {(title || actions) && (
                <div className="ch">
                    <div>
                        {title && <h3>{title}</h3>}
                        {desc && <p>{desc}</p>}
                    </div>
                    <div className="sp" />
                    {actions}
                </div>
            )}
            <div className="cb">{children}</div>
        </div>
    );
}

export function Field({ label, hint, children }) {
    return (
        <label className="field">
            <span style={{ fontSize: '12.5px', fontWeight: 600 }}>{label}</span>
            {children}
            {hint && <span className="hint">{hint}</span>}
        </label>
    );
}

export function Text({ value, onChange, ...rest }) {
    return (
        <input
            className="inp"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            {...rest}
        />
    );
}

export function Num({ value, onChange, ...rest }) {
    return (
        <input
            className="inp"
            type="number"
            value={value ?? 0}
            onChange={(e) => onChange(Number(e.target.value))}
            {...rest}
        />
    );
}

export function Seg({ options, value, onChange }) {
    return (
        <div className="seg">
            {options.map((o) => (
                <button
                    key={o}
                    type="button"
                    className={o === value ? 'on' : ''}
                    onClick={() => onChange(o)}
                >
                    {o}
                </button>
            ))}
        </div>
    );
}

export function Toggle({ on, onChange, label }) {
    return (
        <button
            type="button"
            className={'tog' + (on ? ' on' : '')}
            aria-label={label || 'toggle'}
            aria-pressed={on}
            onClick={() => onChange(!on)}
        />
    );
}

export function SaveBar({ dirty, saving, onSave, onReset }) {
    if (!dirty) return null;
    return (
        <div className="save-bar">
            <span className="d">
                <span className="dot a" /> Có thay đổi chưa lưu
            </span>
            <button className="btn ghost sm" onClick={onReset} disabled={saving}>
                Hoàn tác
            </button>
            <button className="btn pri sm" onClick={onSave} disabled={saving}>
                {saving ? 'Đang lưu…' : 'Lưu & áp dụng'}
            </button>
        </div>
    );
}

// Local editable copy of a config object with dirty tracking.
export function useDraft(initial) {
    const [draft, setDraft] = useState(initial);
    const [base, setBase] = useState(initial);
    const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(base), [draft, base]);
    return {
        draft,
        dirty,
        set: (k, v) => setDraft((d) => ({ ...d, [k]: v })),
        setAll: setDraft,
        reset: () => setDraft(base),
        commit: (next) => {
            setBase(next);
            setDraft(next);
        },
    };
}
