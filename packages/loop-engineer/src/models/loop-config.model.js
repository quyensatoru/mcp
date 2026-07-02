import mongoose from 'mongoose';

// Singleton: one document holds the Loop Engineer guardrails, editable from the console.
const loopConfigSchema = new mongoose.Schema(
    {
        _k: { type: String, default: 'singleton', unique: true },
        enabled: { type: Boolean, default: true },
        maxIterations: { type: Number, default: 6 },
        iterationMaxTurns: { type: Number, default: 15 },
        costCeilingUsd: { type: Number, default: 2 },
    },
    { versionKey: false, timestamps: true },
);

export const LoopConfig = mongoose.model('LoopConfig', loopConfigSchema);
