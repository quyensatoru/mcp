import mongoose from 'mongoose';
import { getModel } from '../../services/shard-resolver.service.js';

const schema = new mongoose.Schema(
    { domain: String, proxy: { type: Number, default: 1 } },
    { versionKey: false, timestamps: true, collection: 'shops' },
);

export const getProxyModel = (conn) => getModel(conn, 'shops', schema);
