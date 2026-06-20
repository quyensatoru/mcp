import mongoose from 'mongoose';
import { getModel } from '../../services/shard-resolver.service.js';

const schema = new mongoose.Schema({
  type: String,
  data: Object,
  timestamp: Number,
  funnels: [String],
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
  pageView: { type: mongoose.Schema.Types.ObjectId, ref: 'PageView' },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session' },
}, { timestamps: true, versionKey: false });

export const getBehaviorModel = (conn) => getModel(conn, 'Behavior', schema);
