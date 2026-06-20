import { registerMidaDocResource } from './mida-doc.resource.js';

export function registerAllResources(server) {
    registerMidaDocResource(server);
}
