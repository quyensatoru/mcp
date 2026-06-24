import mongoose from 'mongoose';
import { Db } from '../../config/db.config.js';

const VisitorSchema = new mongoose.Schema(
    {
        os: String,
        device: String,
        browser: String,
        location: String,
        address: { city: String, state: String },
        ip: String,
        shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
    },
    { timestamps: true, versionKey: false },
);

export const VisitorModels = {
    1: Db.ApiV1.model('Visitor', VisitorSchema),
    2: Db.ApiV2.model('Visitor', VisitorSchema),
};
