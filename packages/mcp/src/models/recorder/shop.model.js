import mongoose from 'mongoose';
import { Db } from '../../config/db.config.js';

const RecorderShopSchema = new mongoose.Schema(
    {
        domain: String,
        access_token: String,
        status: Boolean,
        plan_code: String,
        subscription_info: {
            title: String,
            code: String,
            session_limit: Number,
            amount: Number,
            sub_type: String,
            storage_days: Number,
        },
        embed_block: Boolean,
        session_count: Number,
        proxy: Number,
    },
    { timestamps: true, versionKey: false },
);

export const RecorderShopModels = {
    1: Db.RecorderV1.model('Shop', RecorderShopSchema),
    2: Db.RecorderV2.model('Shop', RecorderShopSchema),
};
