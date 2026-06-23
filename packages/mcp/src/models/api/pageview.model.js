import mongoose from 'mongoose';
import { getModel } from '../../services/shard-resolver.service.js';

const schema = new mongoose.Schema(
    {
        href: String,
        status: Boolean,
        key: String,
        width: Number,
        height: Number,
        tags: [String],
        viewed: Boolean,
        theme_template: String,
        page_type: String,
        shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
        session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session' },
        page: { type: mongoose.Schema.Types.ObjectId, ref: 'Page' },
        start_time: String,
        end_time: String,
        type: String,
    },
    { timestamps: true, versionKey: false },
);

export const getPageViewModel = (conn) => getModel(conn, 'PageView', schema);
