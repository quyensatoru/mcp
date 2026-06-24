import mongoose from 'mongoose';
import { Db } from '../../config/db.config.js';

const ScrollSchema = new mongoose.Schema(
    {
        depth: Number,
        percent: Number,
        counts: Number,
        device: String,
        page: { type: mongoose.Schema.Types.ObjectId, ref: 'Page' },
        pageView: { type: mongoose.Schema.Types.ObjectId, ref: 'PageView' },
        shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
    },
    { versionKey: false, strict: false, collection: 'scrollv3' },
);

export const ScrollModels = {
    1: Db.HeatmapV1.model('HeatmapScroll', ScrollSchema),
    2: Db.HeatmapV2.model('HeatmapScroll', ScrollSchema),
};
