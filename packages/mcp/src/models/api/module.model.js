import mongoose from 'mongoose';
import { Db } from '../../config/db.config.js';

const ModuleSchema = new mongoose.Schema(
    {
        key: { type: String, enum: ['sr', 'sv'] },
        status: Boolean,
        metafield_id: String,
        shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
    },
    { timestamps: true, versionKey: false },
);

export const ModuleModels = {
    1: Db.ApiV1.model('Module', ModuleSchema),
    2: Db.ApiV2.model('Module', ModuleSchema),
};
