import mongoose from 'mongoose';
import { getModel } from '../../services/shard-resolver.service.js';

const schema = new mongoose.Schema(
    {
        key: String,
        viewed: Boolean,
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
        mark_as_favorite: Boolean,
        frustrated: Boolean,
        source: { url: String, type: String },
        cart_value: {
            items: [Object],
            original_total_price: mongoose.Schema.Types.Mixed,
            currency: String,
        },
        visit_number: Number,
        page_per_session: Number,
        exit_page: String,
        events: [String],
        click_count: Number,
        orders: [String],
        orders_info: [Object],
        ai_summary: String,
        relevance_score: Number,
    },
    { timestamps: true, versionKey: false },
);

export const getSessionModel = (conn) => getModel(conn, 'Session', schema);
