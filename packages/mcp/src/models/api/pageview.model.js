import mongoose from 'mongoose';
import { Db } from '../../config/db.config.js';

const PageViewSchema = new mongoose.Schema(
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

export const PageViewModels = {
    1: Db.ApiV1.model('PageView', PageViewSchema),
    2: Db.ApiV2.model('PageView', PageViewSchema),
};
