import mongoose from 'mongoose';

// Encrypted-at-rest credential vault. `value` is ciphertext when encrypted=true.
const secretSchema = new mongoose.Schema(
    {
        key: { type: String, unique: true },
        value: { type: String, default: '' },
        encrypted: { type: Boolean, default: false },
        updatedBy: { type: String, default: 'system' },
    },
    { versionKey: false, timestamps: true },
);

export const Secret = mongoose.model('Secret', secretSchema);
