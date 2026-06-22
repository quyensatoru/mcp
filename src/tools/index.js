import { registerPingTool } from './ping.tool.js';
import { registerDocsTool } from './docs.tool.js';
import { registerLokiTools } from './loki.tool.js';
import { registerMongoTools } from './mongo.tool.js';
import { registerMongoPipelineTools } from './mongo-pipeline.tool.js';
import { registerMongoIntegrityTools } from './mongo-integrity.tool.js';
import { registerRrwebTools } from './rrweb.tool.js';

export function registerAllTools(server) {
    registerPingTool(server);
    registerDocsTool(server);
    // registerLokiTools(server);
    registerMongoTools(server);
    registerMongoPipelineTools(server);
    registerMongoIntegrityTools(server);
    registerRrwebTools(server);
}
