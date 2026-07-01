import { RecorderModuleModels } from '../../models/recorder/module.model.js';

export const RecorderModuleService = {
    findOne: (proxy, shopId) =>
        RecorderModuleModels[proxy]
            .find({ shop: shopId }, { key: 1, status: 1, metafield_id: 1, updatedAt: 1 })
            .lean()
            .exec(),
};
