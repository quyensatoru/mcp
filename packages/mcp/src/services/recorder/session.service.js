import { RecorderSessionModels } from '../../models/recorder/session.model.js';
import { SessionMissingModels } from '../../models/recorder/session-missing.model.js';
import { dateRangeFilter } from '../../helpers/validate.helper.js';

const SESSION_LIST_FIELDS = {
    key: 1,
    device: 1,
    browser: 1,
    location: 1,
    duration: 1,
    page_per_session: 1,
    frustrated: 1,
    status: 1,
    last_active: 1,
    customer_email: 1,
    createdAt: 1,
};

export const RecorderSessionService = {
    list: (proxy, filter, limit) =>
        RecorderSessionModels[proxy]
            .find(filter, SESSION_LIST_FIELDS)
            .sort({ last_active: -1 })
            .limit(limit)
            .lean()
            .exec(),

    findOne: (proxy, filter) => RecorderSessionModels[proxy].findOne(filter).lean().exec(),

    missing: (proxy, shopId, dateFrom, dateTo, limit = 50) => {
        const created = dateRangeFilter(dateFrom, dateTo);
        const filter = { shop: shopId };
        if (created) filter.createdAt = created;
        return SessionMissingModels[proxy]
            .find(filter, {
                key: 1,
                device: 1,
                browser: 1,
                location: 1,
                ip: 1,
                createdAt: 1,
                last_active: 1,
            })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean()
            .exec();
    },
};
