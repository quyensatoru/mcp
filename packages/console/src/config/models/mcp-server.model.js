import mongoose from 'mongoose';

// One env entry maps an env var name to either a literal value or a secret reference.
const envEntrySchema = new mongoose.Schema(
    {
        name: String,
        value: String,
        secretKey: String,
    },
    { _id: false },
);

export const mcpServerSchema = new mongoose.Schema(
    {
        name: { type: String, unique: true },
        enabled: { type: Boolean, default: true },
        transport: { type: String, default: 'stdio' },
        command: { type: String, default: 'npx' },
        // args may contain ${secret:NAME} placeholders, resolved when building.
        args: { type: [String], default: [] },
        env: { type: [envEntrySchema], default: [] },
        order: { type: Number, default: 0 },
    },
    { versionKey: false, timestamps: true },
);
