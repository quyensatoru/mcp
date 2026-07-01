import { ModuleModels } from '../../models/api/module.model.js';

export const ModuleService = {
    findOne: (proxy, shopId) =>
        ModuleModels[proxy]
            .find({ shop: shopId }, { key: 1, status: 1, metafield_id: 1, updatedAt: 1 })
            .lean()
            .exec(),
};
