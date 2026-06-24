import mongoose from 'mongoose';
import { Db } from '../../config/db.config.js';

const BehaviorSchema = new mongoose.Schema(
    {
        type: String,
        data: Object,
        timestamp: Number,
        funnels: [String],
        shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
        pageView: { type: mongoose.Schema.Types.ObjectId, ref: 'PageView' },
        session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session' },
    },
    { timestamps: true, versionKey: false },
);

export const BehaviorModels = {
    1: Db.ApiV1.model('Behavior', BehaviorSchema),
    2: Db.ApiV2.model('Behavior', BehaviorSchema),
};
