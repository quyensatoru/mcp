import { errorContent } from './format.helper.js';
import { logger } from '@mida/logger';

// Bọc handler tool: bắt lỗi → trả errorContent thay vì throw ra transport.
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
