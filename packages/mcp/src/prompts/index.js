import { registerSystemPrompt } from './system.prompt.js';

export function registerAllPrompts(server) {
    registerSystemPrompt(server);
}
