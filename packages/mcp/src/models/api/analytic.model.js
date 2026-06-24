import mongoose from 'mongoose';
import { Db } from '../../config/db.config.js';

const sessionDataSchema = new mongoose.Schema(
    {
        count: Number,
        count_atc: Number,
        count_visitor: Number,
        count_checkout: Number,
        count_purchased: Number,
        count_view_product: Number,
        count_abandoned_cart: Number,
        count_abandoned_checkout: Number,
        count_browser: { type: Map, of: Number },
        count_country: { type: Map, of: Number },
        count_device: { type: Map, of: Number },
        count_os: { type: Map, of: Number },
        bounce_rate: Number,
        conversion_rate: Number,
        order_funnel: Object,
    },
    { _id: false },
);

const AnalyticSchema = new mongoose.Schema(
    {
        date: String,
        hourArray: [Number],
        data: {
            visitor: { count: Number, new_visitor: Number, returning_visitor: Number },
            session: sessionDataSchema,
            order_funnel: Object,
        },
        shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
    },
    { versionKey: false },
);

export const AnalyticModels = {
    1: Db.ApiV1.model('Analytic', AnalyticSchema),
    2: Db.ApiV2.model('Analytic', AnalyticSchema),
};
