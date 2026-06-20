import mongoose from 'mongoose';
import { getModel } from '../../services/shard-resolver.service.js';

const schema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
  date: Date,
  os: mongoose.Schema.Types.Mixed,
  browser: mongoose.Schema.Types.Mixed,
  device: mongoose.Schema.Types.Mixed,
  location: mongoose.Schema.Types.Mixed,
  count_session: Number,
}, { timestamps: true, versionKey: false, collection: 'analytic_missing' });

export const getAnalyticMissingModel = (conn) => getModel(conn, 'AnalyticMissing', schema);
