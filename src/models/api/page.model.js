import mongoose from 'mongoose';
import { getModel } from '../../services/shard-resolver.service.js';

const schema = new mongoose.Schema({
  address: String,
  title: String,
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
  additional_info: Object,
  hmEnabled: Boolean,
}, { versionKey: false });

export const getPageModel = (conn) => getModel(conn, 'Page', schema);
