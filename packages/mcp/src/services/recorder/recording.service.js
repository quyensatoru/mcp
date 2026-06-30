import { SessionModels } from '../../models/api/session.model.js';
import { ShopModels } from '../../models/api/shop.model.js';
import { ModuleModels } from '../../models/api/module.model.js';
import { SettingModels } from '../../models/api/setting.model.js';
import { ConfigurationModels } from '../../models/api/configuration.model.js';
import { RecorderSessionModels } from '../../models/recorder/session.model.js';
import { RecorderShopModels } from '../../models/recorder/shop.model.js';
import { RecorderModuleModels } from '../../models/recorder/module.model.js';
import { RecorderSettingModels } from '../../models/recorder/setting.model.js';
import { SessionMissingModels } from '../../models/recorder/session-missing.model.js';
import { AnalyticMissingModels } from '../../models/recorder/analytic-missing.model.js';
import { dateRangeFilter } from '../../helpers/validate.helper.js';
import { toObjectId } from '../../helpers/objectid.helper.js';

const COMPARE_FIELDS = ['key', 'status', 'duration', 'last_active', 'page_per_session'];

function fieldDiff(api, replica, fields) {
    return fields
        .filter((f) => JSON.stringify(api?.[f]) !== JSON.stringify(replica?.[f]))
        .map((f) => ({ field: f, api: api?.[f], replica: replica?.[f] }));
}

export const RecordingService = {
    async compareSession(proxy, sessionId) {
        const id = toObjectId(sessionId);
        const [apiDoc, recDoc] = await Promise.all([
            SessionModels[proxy].findById(id).lean().exec(),
            RecorderSessionModels[proxy].findById(id).lean().exec(),
        ]);
        if (!apiDoc) return { status: 'NOT_IN_API', sessionId };
        if (!recDoc) return { status: 'MISSING_IN_RECORDER', sessionId };

        const diffs = fieldDiff(apiDoc, recDoc, COMPARE_FIELDS);
        const lagMs =
            apiDoc.updatedAt && recDoc.updatedAt
                ? Math.abs(new Date(apiDoc.updatedAt) - new Date(recDoc.updatedAt))
                : null;
        return { status: diffs.length ? 'STALE' : 'IN_SYNC', sessionId, diffs, lagMs };
    },

    async compareShopCounts(proxy, domain) {
        const [apiShop, recShop] = await Promise.all([
            ShopModels[proxy].findOne({ domain }, { session_count: 1 }).lean().exec(),
            RecorderShopModels[proxy].findOne({ domain }, { session_count: 1 }).lean().exec(),
        ]);
        return {
            apiCount: apiShop?.session_count ?? null,
            recorderCount: recShop ? (recShop.session_count ?? 0) : null,
            recorderExists: Boolean(recShop),
        };
    },

    async replicaLag(proxy, shopId) {
        const proj = { last_active: 1, updatedAt: 1 };
        const [latestApi, latestRec] = await Promise.all([
            SessionModels[proxy]
                .findOne({ shop: shopId }, proj)
                .sort({ last_active: -1 })
                .lean()
                .exec(),
            RecorderSessionModels[proxy]
                .findOne({ shop: shopId }, proj)
                .sort({ last_active: -1 })
                .lean()
                .exec(),
        ]);
        const apiTs = latestApi?.last_active ?? latestApi?.updatedAt ?? null;
        const recTs = latestRec?.last_active ?? latestRec?.updatedAt ?? null;
        const lagMs = apiTs && recTs ? Math.max(0, new Date(apiTs) - new Date(recTs)) : null;
        return { apiLatest: apiTs, recorderLatest: recTs, lagMs };
    },

    async missing(proxy, shopId, dateFrom, dateTo) {
        const created = dateRangeFilter(dateFrom, dateTo);
        const sessFilter = { shop: shopId };
        if (created) sessFilter.createdAt = created;
        const [sessionMissing, analyticMissing] = await Promise.all([
            SessionMissingModels[proxy]
                .find(sessFilter, { key: 1, createdAt: 1, device: 1, browser: 1, location: 1 })
                .sort({ createdAt: -1 })
                .limit(100)
                .lean()
                .exec(),
            AnalyticMissingModels[proxy]
                .find(
                    { shop: shopId, ...(created ? { date: created } : {}) },
                    { date: 1, count_session: 1 },
                )
                .sort({ date: -1 })
                .limit(30)
                .lean()
                .exec(),
        ]);
        return { sessionMissing, analyticMissing };
    },

    // Module: sr (session recording) / sv (survey) — from API
    moduleApi: (proxy, shopId) =>
        ModuleModels[proxy]
            .find({ shop: shopId }, { key: 1, status: 1, metafield_id: 1, updatedAt: 1 })
            .lean()
            .exec(),

    // Module from Recorder replica
    moduleRecorder: (proxy, shopId) =>
        RecorderModuleModels[proxy]
            .find({ shop: shopId }, { key: 1, status: 1, updatedAt: 1 })
            .lean()
            .exec(),

    // Setting from API
    settingApi: (proxy, shopId) =>
        SettingModels[proxy].findOne({ shop: shopId }, { shop: 0 }).lean().exec(),

    // Setting from Recorder replica
    settingRecorder: (proxy, shopId) =>
        RecorderSettingModels[proxy].findOne({ shop: shopId }, { shop: 0 }).lean().exec(),

    // Configuration (plan limits, heatmap/survey limits, funnel definitions)
    configurationApi: (proxy, shopId) =>
        ConfigurationModels[proxy]
            .findOne(
                { shop: shopId },
                { heatmaps: 1, survey: 1, share_recording: 1, funnel_analytics: 1, restrict_filter: 1, updatedAt: 1 },
            )
            .lean()
            .exec(),
};
