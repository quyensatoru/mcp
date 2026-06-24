import { SessionModels } from '../models/api/session.model.js';
import { PageViewModels } from '../models/api/pageview.model.js';
import { EventModels } from '../models/api/event.model.js';
import { BehaviorModels } from '../models/api/behavior.model.js';
import { VisitorModels } from '../models/api/visitor.model.js';
import { PageModels } from '../models/api/page.model.js';

const SESSION_LIST_FIELDS = {
    key: 1,
    device: 1,
    browser: 1,
    location: 1,
    customer_email: 1,
    duration: 1,
    page_per_session: 1,
    frustrated: 1,
    status: 1,
    last_active: 1,
    createdAt: 1,
};

export const SessionService = {
    list: (proxy, filter, limit) =>
        SessionModels[proxy]
            .find(filter, SESSION_LIST_FIELDS)
            .sort({ last_active: -1 })
            .limit(limit)
            .lean()
            .exec(),

    findOne: (proxy, filter) => SessionModels[proxy].findOne(filter).lean().exec(),

    pageviews: (proxy, sessionId) =>
        PageViewModels[proxy]
            .find(
                { session: sessionId },
                { href: 1, page_type: 1, theme_template: 1, start_time: 1, end_time: 1, status: 1, page: 1 },
            )
            .lean()
            .exec(),

    countEvents: (proxy, pageViewIds) =>
        pageViewIds.length
            ? EventModels[proxy].countDocuments({ pageView: { $in: pageViewIds } }).exec()
            : 0,

    countBehaviors: (proxy, sessionId) =>
        BehaviorModels[proxy].countDocuments({ session: sessionId }).exec(),

    behaviors: (proxy, filter, limit) =>
        BehaviorModels[proxy].find(filter).sort({ timestamp: 1 }).limit(limit).lean().exec(),

    visitor: (proxy, visitorId) =>
        visitorId ? VisitorModels[proxy].findById(visitorId).lean().exec() : null,

    pages: (proxy, filter, limit) =>
        PageModels[proxy].find(filter, { address: 1, title: 1, hmEnabled: 1 }).limit(limit).lean().exec(),
};
