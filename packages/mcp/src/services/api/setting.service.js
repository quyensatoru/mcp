import { SettingModels } from '../../models/api/setting.model.js';

export const SettingService = {
    findOne: (proxy, shopId) =>
        SettingModels[proxy].findOne({ shop: shopId }, { shop: 0 }).lean().exec(),
};
