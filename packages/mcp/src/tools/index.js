import { registerPingTool } from './ping.tool.js';
import { registerDocsTool } from './docs.tool.js';
import { registerShopTool } from './api/shop.tool.js';
import { registerAnalyticsTools } from './api/analytics.tool.js';
import { registerSessionTools } from './api/session.tool.js';
import { registerReplayTools } from './api/replay.tool.js';
import { registerModuleApiTools } from './api/module.tool.js';
import { registerSettingApiTools } from './api/setting.tool.js';
import { registerRecordingTools } from './recorder/recording.tool.js';
import { registerModuleRecorderTools } from './recorder/module.tool.js';
import { registerSettingRecorderTools } from './recorder/setting.tool.js';
import { registerHeatmapTools } from './heatmap/heatmap.tool.js';

export function registerAllTools(server) {
    registerPingTool(server);
    registerDocsTool(server);
    // api
    registerShopTool(server);
    registerAnalyticsTools(server);
    registerSessionTools(server);
    registerReplayTools(server);
    registerModuleApiTools(server);
    registerSettingApiTools(server);
    // recorder
    registerRecordingTools(server);
    registerModuleRecorderTools(server);
    registerSettingRecorderTools(server);
    // heatmap
    registerHeatmapTools(server);
}
