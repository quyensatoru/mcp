import mongoose from 'mongoose';
import { Db } from '../../config/db.config.js';
import { decompress } from '../../helpers/compress.helper.js';

const EventSchema = new mongoose.Schema(
    {
        type: Number,
        hmType: Number,
        data: { type: Object, get: (v) => decompress(v) },
        timestamp: Number,
        pageView: { type: mongoose.Schema.Types.ObjectId, ref: 'PageView' },
    },
    { versionKey: false, toObject: { getters: true }, toJSON: { getters: true } },
);

export const EventModels = {
    1: Db.ApiV1.model('Event', EventSchema),
    2: Db.ApiV2.model('Event', EventSchema),
};
