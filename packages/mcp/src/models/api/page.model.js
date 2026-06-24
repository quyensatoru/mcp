import mongoose from 'mongoose';
import { Db } from '../../config/db.config.js';

const PageSchema = new mongoose.Schema(
    {
        address: String,
        title: String,
        shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
        additional_info: Object,
        hmEnabled: Boolean,
    },
    { versionKey: false },
);

export const PageModels = {
    1: Db.ApiV1.model('Page', PageSchema),
    2: Db.ApiV2.model('Page', PageSchema),
};
