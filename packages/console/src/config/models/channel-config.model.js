import mongoose from 'mongoose';

// Singleton: Mattermost channel + approval-flow behaviour.
export const channelConfigSchema = new mongoose.Schema(
    {
        _k: { type: String, default: 'singleton', unique: true },
        channelIds: { type: [String], default: [] },
        botMention: { type: String, default: '' },
        loadingGif: { type: String, default: '' },
        streamFlushMs: { type: Number, default: 600 },
        approvalTimeoutMs: { type: Number, default: 120000 },
        // Regex source matching an "allow" reply.
        yesRegex: { type: String, default: '' },
    },
    { versionKey: false, timestamps: true },
);
