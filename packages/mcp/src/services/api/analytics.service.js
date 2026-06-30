import { AnalyticModels } from '../../models/api/analytic.model.js';

export const AnalyticService = {
    byDateRange: (proxy, shopId, dateFrom, dateTo) =>
        AnalyticModels[proxy]
            .find({ shop: shopId, date: { $gte: dateFrom, $lte: dateTo } })
            .sort({ date: 1 })
            .lean()
            .exec(),
};
