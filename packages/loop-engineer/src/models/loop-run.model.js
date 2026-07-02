import mongoose from 'mongoose';

const iterationSchema = new mongoose.Schema(
    {
        index: Number,
        status: { type: String, enum: ['running', 'done', 'error'] },
        startedAt: Date,
        endedAt: Date,
        costUsd: Number,
        turns: Number,
        toolCount: Number,
        summary: { type: String, maxlength: 2000 },
    },
    { _id: false },
);

const loopRunSchema = new mongoose.Schema(
    {
        runKey: { type: String, index: true }, // chatKey | `${threadId}:${channelId}`
        source: { type: String, enum: ['chat', 'mattermost'] },
        prompt: String,
        status: {
            type: String,
            enum: ['running', 'done', 'stopped', 'max_reached', 'error'],
            default: 'running',
        },
        maxIterations: Number,
        sessionId: String, // latest Claude Agent SDK session id, for resume across iterations
        iterations: [iterationSchema],
        startedAt: Date,
        endedAt: Date,
    },
    { versionKey: false, timestamps: true },
);

loopRunSchema.index({ runKey: 1, startedAt: -1 });

export const LoopRun = mongoose.model('LoopRun', loopRunSchema);
