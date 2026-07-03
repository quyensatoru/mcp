const SECRET_KEYS = new Set(['access_token', 'accessToken', 'password', 'secret', 'token', 'jwt']);
const MODULE_KEY_LABEL = { sr: 'Session Recording', sv: 'Survey' };

export function formatAnalytics(analytics, domain, from, to) {
    if (!analytics.length) return `No analytics for ${domain} (${from} → ${to}).`;
    return [
        `Analytics ${domain} (${from} → ${to}) — ${analytics.length} days:`,
        '',
        ...analytics.map((a) => {
            const v = a.data?.visitor ?? {};
            const s = a.data?.session ?? {};
            return (
                `${a.date}: visitors ${v.count ?? 0} (new ${v.new_visitor ?? 0}/return ${v.returning_visitor ?? 0}) · ` +
                `sessions ${s.count ?? 0} · add-to-cart ${s.count_atc ?? 0} · checkout ${s.count_checkout ?? 0} · ` +
                `purchased ${s.count_purchased ?? 0} · conversion_rate ${s.conversion_rate ?? 0} · bounce ${s.bounce_rate ?? 0}`
            );
        }),
    ].join('\n');
}

export function formatModule(modules, domain, source) {
    if (!modules.length) return `No module records found in ${source} for ${domain}.`;
    const lines = [`${source} modules — ${domain}`];
    for (const m of modules) {
        const label = MODULE_KEY_LABEL[m.key] ?? m.key;
        lines.push(
            `  ${label} (${m.key}): ${m.status ? 'ON' : 'OFF'} · metafield: ${m.metafield_id ?? '—'} · updated: ${m.updatedAt ? new Date(m.updatedAt).toISOString() : '—'}`,
        );
    }
    return lines.join('\n');
}

export function formatConfiguration(config, domain, source) {
    if (!config) return `No configuration found in ${source} for ${domain}.`;
    const hm = config.heatmaps ?? {};
    const sv = config.survey ?? {};
    const sr = config.share_recording ?? {};
    const lines = [
        `Configuration in ${source} — ${domain}`,
        `  Heatmaps: limit=${hm.limit ?? '—'} · extend=${hm.extend ?? '—'} · pages=${hm.pages?.length ?? 0} · lock_metric=${hm.lock_metric_status ?? '—'}`,
        `  Survey: limit=${sv.limit ?? '—'} · extend=${sv.extend ?? '—'}`,
        `  Share recording: type=${sr.type ?? '—'}`,
    ];

    lines.push(`  updatedAt: ${config.updatedAt ? new Date(config.updatedAt).toISOString() : '—'}`);
    return lines.join('\n');
}

export function formatSessionList(sessions, domain, source) {
    if (!sessions.length) return `No sessions match the filter in ${source} for ${domain}.`;
    const rows = sessions.map((s, i) => {
        const flags = [s.frustrated && 'frustrated', s.status === false && 'open'].filter(Boolean);
        const head = `${i + 1}. ${s.device ?? '?'}/${s.browser ?? '?'} · ${s.location ?? '?'} · ${s.duration ?? 0}s · ${s.page_per_session ?? 0}pv${flags.length ? ` · ${flags.join(',')}` : ''}`;
        const sub = ` sessionId: ${s._id} · key: ${s.key ?? '—'} · ${s.last_active ? new Date(s.last_active).toISOString() : '—'}`;
        return `${head}\n${sub}`;
    });
    return [`${sessions.length} sessions in ${source} — ${domain}:`, '', ...rows].join('\n');
}

export function formatSessionDetail(data, domain, source) {
    const { session, visitor, pageviews, counts, flags } = data;
    const lines = [
        `Session ${session.key ?? session._id} — ${domain} (${source})`,
        `  device: ${session.device ?? '?'}/${session.browser ?? '?'}/${session.os ?? '?'} · ${session.location ?? '?'}`,
        `  duration: ${session.duration ?? 0}s (active ${session.active_duration ?? 0}s) · pages: ${counts.pageviews} · status: ${session.status ? 'closed' : 'open'}`,
        `  frustrated: ${session.frustrated ? 'yes' : 'no'} · clicks: ${session.click_count ?? 0} · last_active: ${session.last_active ? new Date(session.last_active).toISOString() : '—'}`,
        `  customer: ${maskEmail(session.customer_email)}`,
        '',
    ];
    if (counts) {
        lines.push(
            `Counts: ${counts.pageviews} pageviews · ${counts.events} rrweb events · ${counts.behaviors} behaviors`,
        );
    }
    if (visitor) {
        lines.push(
            `Visitor: ${visitor._id} · ${visitor.device ?? '?'} · ${visitor.location ?? '?'}`,
        );
    }
    if (pageviews.length) {
        lines.push('', 'Pageviews:');
        pageviews.forEach((p, i) =>
            lines.push(
                `  ${i + 1}. [${p.page_type ?? '?'}] ${abbreviate(p.href, 70)} (${p.theme_template ?? '—'})`,
            ),
        );
    }
    if (flags.length) {
        lines.push('', 'Flags:', ...flags.map((f) => `  ⚠️ ${f}`));
    }
    return lines.join('\n');
}

export function formatSetting(setting, domain, source) {
    if (!setting) return `No setting found in ${source} for ${domain}.`;
    const lines = [
        `Setting (${source}) — ${domain}`,
        `  replay_speed: ${setting.replay_speed ?? '—'} · replay_autoplay: ${setting.replay_autoplay ?? '—'} · replay_mode: ${setting.replay_mode ?? '—'}`,
        `  delay_capture: ${setting.delay_capture ?? '—'} · mask_checkout: ${setting.mask_checkout ?? '—'}`,
        `  collect_email: ${setting.collect_email ?? '—'} · require_consent: ${setting.require_consent ?? '—'} · show_cookies_bar: ${setting.show_cookies_bar ?? '—'}`,
        `  excluded_ips: ${setting.excluded_ips?.length ? setting.excluded_ips.join(', ') : 'none'}`,
        `  excluded_countries: ${setting.excluded_countries?.length ? setting.excluded_countries.join(', ') : 'none'}`,
    ];
    if (setting.weekly_email_report) {
        const wer = setting.weekly_email_report;
        lines.push(
            `  weekly_email_report: ${wer.status ? 'ON' : 'OFF'} · day=${wer.day_of_week ?? '—'} hour=${wer.hour_of_day ?? '—'}`,
        );
    }
    if (setting.analytic_sync) {
        const as = setting.analytic_sync;
        lines.push(`  analytic_sync: ${as.status ? 'ON' : 'OFF'} · type=${as.sync_type ?? '—'}`);
    }
    lines.push(
        `  updatedAt: ${setting.updatedAt ? new Date(setting.updatedAt).toISOString() : '—'}`,
    );
    return lines.join('\n');
}

export function formatShop(shop, proxy, source) {
    const sub = shop.subscription_info ?? {};
    const started = shop.started ?? {};
    const lines = [
        `Shop information in ${source}`,
        `Domain: ${shop.domain}`,
        `Shard: ${proxy}`,
        `Status: ${shop.status ? 'active' : 'inactive'}`,
        `Plan: ${shop.plan_code ?? '—'} (${sub.title ?? '—'})`,
        `Sessions: ${shop.session_count ?? 0} / ${sub.session_limit ?? '—'} (${pct(shop.session_count ?? 0, sub.session_limit)})`,
        `AI session limit: ${sub.ai_session_limit ?? '—'} · storage: ${sub.storage_days ?? '—'} days`,
        `Embed block: ${shop.embed_block ? 'ON' : 'OFF'} · pixel_id: ${shop.pixel_id ?? '—'}`,
        `Daily quota: ${shop.daily_quota_enabled ? `${shop.daily_used_quota_limit ?? 0} / ${shop.quota_limit_per_day ?? '—'}` : 'disabled'}`,
        `Onboarding: visitor=${started.view_visitor ? '✓' : '✗'} heatmap=${started.view_heatmap ? '✓' : '✗'} completed=${started.completed ? '✓' : '✗'}`,
        `Country: ${shop.country ?? '—'} · Shopify plan: ${shop.shopify_plan ?? '—'}`,
    ];
    if (shop.uninstall_app_date)
        lines.push(`⚠️ Uninstalled: ${new Date(shop.uninstall_app_date).toISOString()}`);
    return lines.join('\n');
}

//Helpers
export function redact(value) {
    if (Array.isArray(value)) return value.map(redact);
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([k, v]) => [
                k,
                SECRET_KEYS.has(k) ? '[REDACTED]' : redact(v),
            ]),
        );
    }
    return value;
}

export const pct = (num, denom) => (denom ? `${((num / denom) * 100).toFixed(1)}%` : '—');

export function abbreviate(str, max = 80) {
    if (!str) return '';
    return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

export function maskEmail(email) {
    if (!email || !email.includes('@')) return email ?? '';
    const [name, host] = email.split('@');
    return `${name.slice(0, 2)}***@${host}`;
}

export function section(title, lines) {
    return [title, ...lines.filter(Boolean).map((l) => `  ${l}`)].join('\n');
}

export function textContent(text) {
    return { content: [{ type: 'text', text }] };
}

export function errorContent(message, hint) {
    return {
        isError: true,
        content: [{ type: 'text', text: hint ? `${message}\n\nGợi ý: ${hint}` : message }],
    };
}
