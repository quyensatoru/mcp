import mongoose from 'mongoose';
import { getShardConns } from './shard-resolver.service.js';
import { getSessionModel } from '../models/api/session.model.js';
import { getRecorderSessionModel } from '../models/recorder/session.model.js';
import { getShopModel } from '../models/api/shop.model.js';
import { getRecorderShopModel } from '../models/recorder/shop.model.js';
import { getSessionMissingModel } from '../models/recorder/session-missing.model.js';
import { getAnalyticMissingModel } from '../models/recorder/analytic-missing.model.js';

const ObjectId = mongoose.Types.ObjectId;
function tryId(s) {
    try {
        return new ObjectId(s);
    } catch {
        return s;
    }
}

function fieldDiff(apiDoc, repDoc, fields) {
    const diffs = [];
    for (const f of fields) {
        const a = apiDoc?.[f],
            r = repDoc?.[f];
        if (JSON.stringify(a) !== JSON.stringify(r)) diffs.push({ field: f, api: a, replica: r });
    }
    return diffs;
}

export const replicaCompareService = {
    async compareSession(domain, sessionId) {
        const { api, recorder } = await getShardConns(domain);
        const Session = getSessionModel(api);
        const RecSession = recorder ? getRecorderSessionModel(recorder) : null;

        const apiDoc = await Session.findById(tryId(sessionId)).lean().exec();
        const recDoc = RecSession
            ? await RecSession.findById(tryId(sessionId)).lean().exec()
            : null;

        if (!apiDoc) return { status: 'NOT_IN_API', sessionId };
        if (!recDoc)
            return {
                status: 'MISSING_IN_RECORDER',
                sessionId,
                apiExists: true,
                hint: 'Recorder consumer có thể lỗi. Chạy loki_queue_health với channel=recorder-backup.',
            };

        const compareFields = [
            'key',
            'status',
            'duration',
            'last_active',
            'page_per_session',
            'click_count',
        ];
        const diffs = fieldDiff(apiDoc, recDoc, compareFields);
        const lagMs =
            apiDoc.updatedAt && recDoc.updatedAt
                ? Math.abs(new Date(apiDoc.updatedAt) - new Date(recDoc.updatedAt))
                : null;

        return {
            status: diffs.length ? 'STALE' : 'IN_SYNC',
            sessionId,
            lagMs,
            diffs,
            hint: diffs.length
                ? 'Recorder có data nhưng lệch — consumer xử lý chậm hoặc partial failure.'
                : null,
        };
    },

    async compareShop(domain) {
        const { api, recorder } = await getShardConns(domain);
        const Shop = getShopModel(api);
        const RecShop = recorder ? getRecorderShopModel(recorder) : null;

        const apiDoc = await Shop.findOne(
            { domain },
            { domain: 1, status: 1, plan_code: 1, session_count: 1, embed_block: 1 },
        )
            .lean()
            .exec();
        const recDoc = RecShop
            ? await RecShop.findOne(
                  { domain },
                  { domain: 1, status: 1, plan_code: 1, session_count: 1 },
              )
                  .lean()
                  .exec()
            : null;

        if (!apiDoc) return { status: 'NOT_IN_API', domain };
        if (!recDoc) return { status: 'MISSING_IN_RECORDER', domain };

        const diffs = fieldDiff(apiDoc, recDoc, ['status', 'plan_code', 'session_count']);
        return { status: diffs.length ? 'STALE' : 'IN_SYNC', domain, diffs };
    },

    async missingReport(domain, dateFrom, dateTo) {
        const { recorder, api } = await getShardConns(domain);
        if (!recorder) return { error: 'Recorder DB chưa được cấu hình (RECORDER_URI_1/2)' };

        const Shop = getShopModel(api);
        const shop = await Shop.findOne({ domain }, { _id: 1 }).lean().exec();
        if (!shop) return { error: `Shop ${domain} không tìm thấy trong api` };

        const SessionMissing = getSessionMissingModel(recorder);
        const AnalyticMissing = getAnalyticMissingModel(recorder);

        const baseFilter = { shop: shop._id };
        if (dateFrom) baseFilter.createdAt = { $gte: new Date(dateFrom) };
        if (dateTo)
            baseFilter.createdAt = {
                ...baseFilter.createdAt,
                $lte: new Date(dateTo + 'T23:59:59Z'),
            };

        const [sessionMissing, analyticMissing] = await Promise.all([
            SessionMissing.find(baseFilter, {
                key: 1,
                createdAt: 1,
                device: 1,
                browser: 1,
                location: 1,
            })
                .sort({ createdAt: -1 })
                .limit(100)
                .lean()
                .exec(),
            AnalyticMissing.find(
                { shop: shop._id, ...(dateFrom ? { date: { $gte: new Date(dateFrom) } } : {}) },
                { date: 1, count_session: 1, createdAt: 1 },
            )
                .sort({ date: -1 })
                .limit(30)
                .lean()
                .exec(),
        ]);

        return {
            domain,
            sessionMissing: { count: sessionMissing.length, items: sessionMissing },
            analyticMissing: { count: analyticMissing.length, items: analyticMissing },
            diagnosis:
                sessionMissing.length || analyticMissing.length
                    ? `ℹ️ sessionmissings=${sessionMissing.length} — shop đã đạt giới hạn session quota của plan (tính năng thiết kế, không phải lỗi). Dùng mongo_resolve_shop để xem subscription_info.session_limit.`
                    : '✅ Không có missing records trong khoảng thời gian này',
        };
    },

    async replicaLag(domain) {
        const { api, recorder } = await getShardConns(domain);
        if (!recorder) return { error: 'Recorder chưa cấu hình' };

        const Session = getSessionModel(api);
        const RecSession = getRecorderSessionModel(recorder);
        const Shop = getShopModel(api);
        const shop = await Shop.findOne({ domain }, { _id: 1 }).lean().exec();
        if (!shop) return { error: `Shop ${domain} không tìm thấy` };

        const shopFilter = { shop: shop._id };
        const [latestApi, latestRec] = await Promise.all([
            Session.findOne(shopFilter, { last_active: 1, updatedAt: 1 })
                .sort({ last_active: -1 })
                .lean()
                .exec(),
            RecSession.findOne(shopFilter, { last_active: 1, updatedAt: 1 })
                .sort({ last_active: -1 })
                .lean()
                .exec(),
        ]);

        const apiTs = latestApi?.last_active ?? latestApi?.updatedAt;
        const recTs = latestRec?.last_active ?? latestRec?.updatedAt;
        const lagMs = apiTs && recTs ? Math.max(0, new Date(apiTs) - new Date(recTs)) : null;

        return {
            domain,
            api_latest: apiTs,
            recorder_latest: recTs,
            lag_ms: lagMs,
            lag_human: lagMs != null ? `${Math.round(lagMs / 1000)}s` : 'unknown',
            status:
                lagMs == null
                    ? 'UNKNOWN'
                    : lagMs > 300000
                      ? '⚠️ LAG > 5min'
                      : lagMs > 60000
                        ? '⚠️ LAG > 1min'
                        : '✅ OK',
        };
    },
};
