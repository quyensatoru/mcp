import { ConfigurationModels } from "../../models/api/configuration.model.js";

export const ConfigurationService = {
    findOne: (proxy, shopId) =>
        ConfigurationModels[proxy]
            .findOne(
                { shop: shopId },
                { heatmaps: 1, survey: 1, share_recording: 1, restrict_filter: 1, updatedAt: 1 },
            )
            .lean()
            .exec(),
}