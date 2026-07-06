import mongoose from 'mongoose';

const refSchema = new mongoose.Schema(
    { repo: String, file: String, line: String, symbol: String }, // line: "228" hoặc "228-238"
    { _id: false },
);

const knowledgeSchema = new mongoose.Schema(
    {
        type: { type: String, index: true },
        key: { type: String, unique: true, sparse: true },
        title: String,
        tags: { type: [String], default: [], index: true },
        body: String,
        data: mongoose.Schema.Types.Mixed,
        confidence: { type: String, enum: ['verified', 'likely', 'hypothesis'] },
        refs: { type: [refSchema], default: [] },
        source: { type: String, enum: ['skill', 'agent', 'manual'], default: 'agent' },
        stats: {
            uses: { type: Number, default: 0 },
            lastUsedAt: Date,
        },
        enabled: { type: Boolean, default: true },
    },
    { versionKey: false, timestamps: true },
);

knowledgeSchema.index({ title: 'text', body: 'text', tags: 'text' });

export const Knowledge = mongoose.model('Knowledge', knowledgeSchema);
