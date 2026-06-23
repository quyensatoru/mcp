import mongoose from 'mongoose';
import { getModel } from '../../services/shard-resolver.service.js';

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

const schema = new mongoose.Schema(
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

export const getAnalyticModel = (conn) => getModel(conn, 'Analytic', schema);
