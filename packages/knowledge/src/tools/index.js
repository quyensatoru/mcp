import { registerPingTool } from './ping.tool.js';
import { registerKnowledgeTools } from './knowledge.tool.js';

export function registerAllTools(server) {
    registerPingTool(server);
    registerKnowledgeTools(server);
}
