import mongoose from 'mongoose';

const branchRuleSchema = new mongoose.Schema(
    {
        type: String,
        pattern: String,
    },
    { _id: false },
);

// Singleton: workspace dirs, worktree cleanup + branch naming rules, GitLab sync target.
export const workspaceConfigSchema = new mongoose.Schema(
    {
        _k: { type: String, default: 'singleton', unique: true },
        workDir: { type: String, default: 'workspace' },
        sessionsDir: { type: String, default: 'sessions' },
        cleanupDays: { type: Number, default: 7 },
        worktreeBranchPrefix: { type: String, default: 'wt/' },
        branchRules: { type: [branchRuleSchema], default: [] },
        gitlab: {
            url: { type: String, default: '' },
            projectId: { type: String, default: '' },
        },
    },
    { versionKey: false, timestamps: true },
);
