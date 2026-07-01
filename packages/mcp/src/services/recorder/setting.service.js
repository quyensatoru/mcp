import { RecorderSettingModels } from "../../models/recorder/setting.model.js";

export const RecorderSettingService = {
    findOne: (proxy, shopId) =>
        RecorderSettingModels[proxy].findOne({ shop: shopId }, { shop: 0 }).lean().exec(),
};