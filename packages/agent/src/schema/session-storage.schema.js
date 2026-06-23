import mongoose from 'mongoose';

const sessionStorageSchema = new mongoose.Schema(
    {
        sesssionId: { type: mongoose.Schema.Types.String },
        threadId: { type: mongoose.Schema.Types.String },
        channelId: { type: mongoose.Schema.Types.String },
    },
    {
        versionKey: false,
        _id: true,
    },
);

export const sessionStorageModel = mongoose.model('SessionStorage', sessionStorageModel);
