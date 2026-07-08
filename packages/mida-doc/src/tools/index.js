import { registerPingTool } from './ping.tool.js';
import { registerDocsTool } from './docs.tool.js';

export function registerAllTools(server) {
    registerPingTool(server);
    registerDocsTool(server);
}
