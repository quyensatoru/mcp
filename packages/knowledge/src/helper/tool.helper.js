import { errorContent } from './format.helper.js';
import { logger } from '@mida/logger';

export function wrap(name, fn) {
    return async (args) => {
        try {
            return await fn(args);
        } catch (err) {
            logger.warn({ err }, `${name} failed`);
            return errorContent(`${name}: ${err.message}`);
        }
    };
}
