import mongoose from 'mongoose';

// Maps a Claude Agent SDK session to the chat thread that started it (Mattermost).
const sessionStorageSchema = new mongoose.Schema(
    {
        sessionId: String,
        threadId: String,
        channelId: String,
    },
    { versionKey: false, _id: true },
);

sessionStorageSchema.index({ sessionId: 1 });

export const SessionStorage = mongoose.model('SessionStorage', sessionStorageSchema);
