import mongoose from 'mongoose';

export const subagentSchema = new mongoose.Schema(
    {
        name: { type: String, unique: true },
        description: { type: String, default: '' },
        prompt: { type: String, default: '' },
        model: String,
        tools: { type: [String], default: [] },
        enabled: { type: Boolean, default: true },
    },
    { versionKey: false, timestamps: true },
);
