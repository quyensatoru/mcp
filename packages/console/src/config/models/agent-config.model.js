import mongoose from 'mongoose';

// Singleton: one document holds the agent runtime config + system prompt.
export const agentConfigSchema = new mongoose.Schema(
    {
        _k: { type: String, default: 'singleton', unique: true },
        model: String,
        maxTurns: { type: Number, default: 30 },
        effort: { type: String, enum: ['low', 'medium', 'high', 'xhigh'], default: 'medium' },
        permissionMode: {
            type: String,
            enum: ['default', 'acceptEdits', 'plan', 'bypassPermissions'],
            default: 'acceptEdits',
        },
        systemPromptAppend: { type: String, default: '' },
        disallowedTools: { type: [String], default: [] },
        allowedTools: { type: [String], default: [] },
        settingSources: { type: [String], default: ['project'] },
        concurrency: { type: Number, default: 3 },
    },
    { versionKey: false, timestamps: true },
);
