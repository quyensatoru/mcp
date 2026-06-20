import mongoose from 'mongoose';
import { getModel } from '../../services/shard-resolver.service.js';

const schema = new mongoose.Schema({
  os: String, device: String, browser: String, location: String,
  address: { city: String, state: String },
  ip: String,
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
}, { timestamps: true, versionKey: false });

export const getVisitorModel = (conn) => getModel(conn, 'Visitor', schema);
