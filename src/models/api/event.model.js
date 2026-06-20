import mongoose from 'mongoose';
import { getModel } from '../../services/shard-resolver.service.js';
import { decompress } from '../../helpers/compress.helper.js';

const schema = new mongoose.Schema({
  type: Number,
  hmType: Number,
  data: {
    type: Object,
    get: (v) => decompress(v),
  },
  timestamp: Number,
  pageView: { type: mongoose.Schema.Types.ObjectId, ref: 'PageView' },
}, { versionKey: false, toObject: { getters: true }, toJSON: { getters: true } });

export const getEventModel = (conn) => getModel(conn, 'Event', schema);
