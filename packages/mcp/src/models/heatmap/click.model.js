import mongoose from 'mongoose';
import { Db } from '../../config/db.config.js';

// strict:false — đọc read-only, giữ mọi field thật của clickv2 (shape chốt khi đối chiếu sample doc).
const ClickSchema = new mongoose.Schema(
    {
        x: Number,
        y: Number,
        counts: Number,
        selector: String,
        device: String,
        type: String,
        page: { type: mongoose.Schema.Types.ObjectId, ref: 'Page' },
        pageView: { type: mongoose.Schema.Types.ObjectId, ref: 'PageView' },
        shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
    },
    { versionKey: false, strict: false, collection: 'clickv2' },
);

export const ClickModels = {
    1: Db.HeatmapV1.model('HeatmapClick', ClickSchema),
    2: Db.HeatmapV2.model('HeatmapClick', ClickSchema),
};
