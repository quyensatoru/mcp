import { registerSystemPrompt } from './system.prompt.js';
import { registerRcaInvestigatePrompt } from './rca-investigate.prompt.js';
import { registerRcaRecordingPrompt } from './rca-recording.prompt.js';
import { registerRcaDataIntegrityPrompt } from './rca-data-integrity.prompt.js';
import { registerRcaRrwebPrompt } from './rca-rrweb.prompt.js';

export function registerAllPrompts(server) {
  registerSystemPrompt(server);
  registerRcaInvestigatePrompt(server);
  registerRcaRecordingPrompt(server);
  registerRcaDataIntegrityPrompt(server);
  registerRcaRrwebPrompt(server);
}
