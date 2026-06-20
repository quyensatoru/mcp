import mongoose from 'mongoose';
import { getModel } from '../../services/shard-resolver.service.js';

const schema = new mongoose.Schema({
  domain: String,
  access_token: String,
  status: Boolean,
  plan_code: String,
  subscription_info: { title: String, code: String, session_limit: Number, amount: Number, sub_type: String, storage_days: Number },
  embed_block: Boolean,
  session_count: Number,
  proxy: Number,
}, { timestamps: true, versionKey: false });

export const getRecorderShopModel = (conn) => getModel(conn, 'Shop', schema);
