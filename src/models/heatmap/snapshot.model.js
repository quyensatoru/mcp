import mongoose from 'mongoose';
import { getModel } from '../../services/shard-resolver.service.js';
import { decompress } from '../../helpers/compress.helper.js';

const schema = new mongoose.Schema({
  type2: {
    type: Object,
    get: (v) => decompress(v),
  },
  type4: { href: String, width: Number, height: Number },
  timestamp: Number,
  device: String,
  page: { type: mongoose.Schema.Types.ObjectId },
}, { versionKey: false, toObject: { getters: true }, toJSON: { getters: true } });

export const getSnapshotModel = (conn) => getModel(conn, 'Snapshot', schema);
