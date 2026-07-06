import 'dotenv/config';
import { knowledgeService } from '../src/config.js';
import { logger } from '@mida/logger';

await knowledgeService.connect();
logger.info('[knowledge] seed done');
process.exit(0);
