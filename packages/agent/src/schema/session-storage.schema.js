import mongoose from 'mongoose';

const sessionStorageSchema = new mongoose.Schema(
    {
        sessionId: String,
        threadId: String,
        channelId: String
    },
    {
        versionKey: false,
        _id: true,
    },
);

sessionStorageSchema.index({ sessionId: 1 })

export const sessionStorageModel = mongoose.model('SessionStorage', sessionStorageSchema);
