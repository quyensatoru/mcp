import { EventModels } from '../../models/api/event.model.js';
import { toObjectId } from '../../helpers/objectid.helper.js';

export const ReplayService = {
    events: (proxy, pageViewId, limit) =>
        EventModels[proxy]
            .find({ pageView: toObjectId(pageViewId) })
            .sort({ timestamp: 1 })
            .limit(limit)
            .lean({ getters: true })
            .exec(),
};
