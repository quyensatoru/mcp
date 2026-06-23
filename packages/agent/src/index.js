import { query } from  "@anthropic-ai/claude-agent-sdk"
import { env } from "./config/env.config.js";
import { mcpServers } from "./config/mcp.config.js";
import { subAgents as agents } from "./config/subagent.config.js";
import express from "express"
import { logger } from "@mida/logger";
import { connectDB } from "./config/mongo.config.js";

const createClaudeAgentSdk = (prompt, sessionId) => {
    return query({
        prompt,
        options: {
            model: env.CLAUDE_MODEL,
            cwd: env.WORK_DIR,
            systemPrompt: {
                type: "preset",
                preset: "claude_code",
                append: []
            },
            settingSources: ["project", "user"],
            permissionMode: "acceptEdits",
            ...(sessionId ? { sessionId } : {}),
            mcpServers,
            agents,
            maxTurns: env.CLAUDE_MAX_TURNS,
            effort: "medium"
        }
    })
}

const bootstrap = () => {
    const app = express()

    connectDB()

    app.listen(env.PORT, () => {
        logger.info(`app listening at http://localhost:${env.PORT}`)
    })
}

bootstrap()