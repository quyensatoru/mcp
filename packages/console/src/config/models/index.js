import { agentConfigSchema } from './agent-config.model.js';
import { mcpServerSchema } from './mcp-server.model.js';
import { subagentSchema } from './subagent.model.js';
import { guardrailSchema } from './guardrail.model.js';
import { channelConfigSchema } from './channel-config.model.js';
import { workspaceConfigSchema } from './workspace-config.model.js';
import { secretSchema } from './secret.model.js';

// Register every config model on a dedicated connection so the config layer is
// independent of whatever default mongoose connection the host process uses.
export function registerModels(conn) {
    return {
        AgentConfig: conn.model('AgentConfig', agentConfigSchema),
        McpServer: conn.model('McpServer', mcpServerSchema),
        Subagent: conn.model('Subagent', subagentSchema),
        Guardrail: conn.model('Guardrail', guardrailSchema),
        ChannelConfig: conn.model('ChannelConfig', channelConfigSchema),
        WorkspaceConfig: conn.model('WorkspaceConfig', workspaceConfigSchema),
        Secret: conn.model('Secret', secretSchema),
    };
}
