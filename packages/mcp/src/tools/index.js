import { registerPingTool } from './ping.tool.js';
import { registerShopTool } from './shop.tool.js';
import { registerAnalyticsTools } from './analytics.tool.js';
import { registerSessionTools } from './session.tool.js';
import { registerHeatmapTools } from './heatmap.tool.js';
import { registerRecordingTools } from './recording.tool.js';
import { registerReplayTools } from './replay.tool.js';
import { registerDocsTool } from './docs.tool.js';

export function registerAllTools(server) {
    registerPingTool(server);
    registerShopTool(server);
    registerAnalyticsTools(server);
    registerSessionTools(server);
    registerHeatmapTools(server);
    registerRecordingTools(server);
    registerReplayTools(server);
    registerDocsTool(server);
}
