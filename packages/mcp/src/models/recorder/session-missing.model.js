import mongoose from 'mongoose';
import { Db } from '../../config/db.config.js';

const SessionMissingSchema = new mongoose.Schema(
    {
        key: String,
        os: String,
        device: String,
        browser: String,
        location: String,
        address: { city: String, state: String },
        ip: String,
        customer_id: String,
        theme_id: String,
        shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
        last_active: Date,
    },
    { timestamps: true, versionKey: false, collection: 'sessionmissings' },
);

export const SessionMissingModels = {
    1: Db.RecorderV1.model('SessionMissing', SessionMissingSchema),
    2: Db.RecorderV2.model('SessionMissing', SessionMissingSchema),
};
