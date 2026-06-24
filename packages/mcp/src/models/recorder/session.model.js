import mongoose from 'mongoose';
import { Db } from '../../config/db.config.js';

const RecorderSessionSchema = new mongoose.Schema(
    {
        key: String,
        os: String,
        device: String,
        browser: String,
        location: String,
        address: { city: String, state: String },
        ip: String,
        tags: [String],
        customer_id: String,
        customer_email: String,
        type: String,
        theme_id: String,
        shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
        visitor: { type: mongoose.Schema.Types.ObjectId, ref: 'Visitor' },
        duration: Number,
        active_duration: Number,
        start_time: String,
        last_active: Date,
        status: Boolean,
        source: { url: String, type: String },
        cart_value: {
            items: [Object],
            original_total_price: mongoose.Schema.Types.Mixed,
            currency: String,
        },
    },
    { timestamps: true, versionKey: false },
);

export const RecorderSessionModels = {
    1: Db.RecorderV1.model('Session', RecorderSessionSchema),
    2: Db.RecorderV2.model('Session', RecorderSessionSchema),
};
