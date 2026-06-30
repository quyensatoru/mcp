import mongoose from 'mongoose';
import { Db } from '../../config/db.config.js';

const ConfigurationSchema = new mongoose.Schema(
    {
        shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
        table_headings: [Object],
        heatmaps: Object,
        survey: Object,
        share_recording: Object,
        funnel_analytics: [Object],
        restrict_filter: Object,
        discount_free: Object,
        shopify: Object,
    },
    { timestamps: true, versionKey: false },
);

export const ConfigurationModels = {
    1: Db.ApiV1.model('Configuration', ConfigurationSchema),
    2: Db.ApiV2.model('Configuration', ConfigurationSchema),
};
