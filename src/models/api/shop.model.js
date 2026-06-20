import mongoose from 'mongoose';
import { getModel } from '../../services/shard-resolver.service.js';

const schema = new mongoose.Schema({
  domain: String,
  access_token: String,
  status: Boolean,
  plan_code: String,
  subscription_info: {
    title: String, code: String, session_limit: Number,
    amount: Number, sub_type: String, storage_days: Number,
    ai_session_limit: Number,
  },
  embed_block: Boolean,
  pixel_id: String,
  session_count: Number,
  daily_quota_enabled: Boolean,
  quota_limit_per_day: Number,
  daily_used_quota_limit: Number,
  started: { view_visitor: Boolean, view_heatmap: Boolean, completed: Boolean },
  proxy: Number,
  shopify_plan: String,
  country: String,
  email: String,
  uninstall_app_date: Date,
  reset_quota: { _day: Number, anchor_day: Number, period_end: Date },
  configs: mongoose.Schema.Types.Mixed,
  internal_configs: mongoose.Schema.Types.Mixed,
}, { timestamps: true, versionKey: false });

export const getShopModel = (conn) => getModel(conn, 'Shop', schema);
