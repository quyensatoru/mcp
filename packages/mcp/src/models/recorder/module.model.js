import mongoose from 'mongoose';
import { Db } from '../../config/db.config.js';

const RecorderModuleSchema = new mongoose.Schema(
    {
        key: { type: String, enum: ['sr', 'sv'] },
        status: Boolean,
        shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
    },
    { timestamps: true, versionKey: false },
);

export const RecorderModuleModels = {
    1: Db.RecorderV1.model('Module', RecorderModuleSchema),
    2: Db.RecorderV2.model('Module', RecorderModuleSchema),
};
