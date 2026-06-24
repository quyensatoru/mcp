import mongoose from 'mongoose';
import { Db } from '../../config/db.config.js';

const AnalyticMissingSchema = new mongoose.Schema(
    {
        shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
        date: Date,
        os: mongoose.Schema.Types.Mixed,
        browser: mongoose.Schema.Types.Mixed,
        device: mongoose.Schema.Types.Mixed,
        location: mongoose.Schema.Types.Mixed,
        count_session: Number,
    },
    { timestamps: true, versionKey: false, collection: 'analytic_missing' },
);

export const AnalyticMissingModels = {
    1: Db.RecorderV1.model('AnalyticMissing', AnalyticMissingSchema),
    2: Db.RecorderV2.model('AnalyticMissing', AnalyticMissingSchema),
};
