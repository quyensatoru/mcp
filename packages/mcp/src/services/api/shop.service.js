import { ShopModels } from '../../models/api/shop.model.js';

export const ShopService = {
    findByDomain: (proxy, domain) =>
        ShopModels[proxy].findOne({ domain }, { access_token: 0 }).lean().exec(),

    idByDomain: async (proxy, domain) => {
        const doc = await ShopModels[proxy].findOne({ domain }, { _id: 1 }).lean().exec();
        return doc?._id ?? null;
    },
};
