import { logger } from "@mida/logger"
import { createClaudeAgent } from "../config/claude.config"

export const handleEvent = async (client, post) => {
    try {
        const claude = createClaudeAgent()
        // console.log(client);
    } catch (e) {
        logger.error(e)
    }
}