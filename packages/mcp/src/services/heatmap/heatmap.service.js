import { ClickModels } from '../../models/heatmap/click.model.js';
import { ScrollModels } from '../../models/heatmap/scroll.model.js';

// Field shape giả định theo skill (x,y,counts,selector,device,type) — model strict:false nên đọc đủ field thật.
export const HeatmapService = {
    clicks: (proxy, filter, limit) =>
        ClickModels[proxy].find(filter).sort({ counts: -1 }).limit(limit).lean().exec(),

    clickSelectors: (proxy, filter, limit) =>
        ClickModels[proxy]
            .aggregate([
                { $match: filter },
                { $group: { _id: '$selector', clicks: { $sum: '$counts' }, points: { $sum: 1 } } },
                { $sort: { clicks: -1 } },
                { $limit: limit },
            ])
            .exec(),

    scrolls: (proxy, filter) =>
        ScrollModels[proxy].find(filter).sort({ depth: 1 }).limit(200).lean().exec(),
};
