import mongoose from 'mongoose';
import { Db } from '../../config/db.config.js';

const MoveSchema = new mongoose.Schema(
    {
        x: Number,
        y: Number,
        counts: Number,
        selector: String,
        device: String,
        page: { type: mongoose.Schema.Types.ObjectId, ref: 'Page' },
        pageView: { type: mongoose.Schema.Types.ObjectId, ref: 'PageView' },
        shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
    },
    { versionKey: false, strict: false, collection: 'movev2' },
);

export const MoveModels = {
    1: Db.HeatmapV1.model('HeatmapMove', MoveSchema),
    2: Db.HeatmapV2.model('HeatmapMove', MoveSchema),
};
