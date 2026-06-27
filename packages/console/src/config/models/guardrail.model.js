import mongoose from 'mongoose';

// Singleton: guardrail rules compiled into agent hooks + auto-approve logic.
export const guardrailSchema = new mongoose.Schema(
    {
        _k: { type: String, default: 'singleton', unique: true },
        // Regex sources (strings) of bash commands to block in PreToolUse.
        denyCommandPatterns: { type: [String], default: [] },
        // Regex source for tool names auto-approved without asking.
        autoApproveReadOnlyRegex: { type: String, default: '' },
        hooks: {
            sessionStart: { type: Boolean, default: true },
            preToolUse: { type: Boolean, default: true },
            postToolUse: { type: Boolean, default: true },
            permissionRequest: { type: Boolean, default: true },
        },
    },
    { versionKey: false, timestamps: true },
);
