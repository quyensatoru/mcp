import mongoose from 'mongoose';
import { getModel } from '../../services/shard-resolver.service.js';

const schema = new mongoose.Schema({
  key: String,
  os: String, device: String, browser: String, location: String,
  address: { city: String, state: String },
  ip: String,
  customer_id: String, theme_id: String,
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
  last_active: Date,
}, { timestamps: true, versionKey: false, collection: 'sessionmissings' });

export const getSessionMissingModel = (conn) => getModel(conn, 'SessionMissing', schema);
