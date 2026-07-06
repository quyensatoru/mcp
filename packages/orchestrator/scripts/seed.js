import { mongo } from '../src/config/mongo.config.js';
import { env } from '../src/config/env.config.js';
import { McpTarget } from '../src/models/index.js';
import { seedTargets } from '../src/seed.js';
import { logger } from '@mida/logger';

// Seed thuần: chỉ connect mongo + ghi McpTarget metadata, không spawn downstream.
await mongo.connect(env.MONGO_URI);
await McpTarget.init().catch(() => {});
const count = await seedTargets();
logger.info(`[orchestrator] seeded ${count} target`);
process.exit(0);
