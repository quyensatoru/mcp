import mongoose from 'mongoose';

const envEntrySchema = new mongoose.Schema(
    {
        name: String,
        value: String,
        secretKey: String,
    },
    { _id: false },
);

const mcpTargetSchema = new mongoose.Schema(
    {
        name: { type: String, unique: true }, // `${kind}-${cluster}`
        kind: { type: String, enum: ['mongo', 'rabbit', 'redis', 'http', 'other'] },
        cluster: String,
        enabled: { type: Boolean, default: true },
        transport: { type: String, default: 'stdio' },
        command: String,
        args: { type: [String], default: [] },
        env: { type: [envEntrySchema], default: [] },
        capability: { type: String, enum: ['read', 'write', 'admin'], default: 'read' },
        order: { type: Number, default: 0 },
    },
    { versionKey: false, timestamps: true },
);

export const McpTarget = mongoose.model('McpTarget', mcpTargetSchema);
