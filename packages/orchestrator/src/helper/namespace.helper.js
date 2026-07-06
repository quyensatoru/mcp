import { NAMESPACE_SEP } from '../constant/defaults.constant.js';

function toLocal(target, tool) {
    const prefix = `${target.kind}_${target.cluster}`.replace(/-/g, '_');
    return `${prefix}${NAMESPACE_SEP}${tool}`;
}

function parse(localName) {
    const idx = localName.indexOf(NAMESPACE_SEP);
    if (idx === -1) return null;
    return {
        prefix: localName.slice(0, idx),
        tool: localName.slice(idx + NAMESPACE_SEP.length),
    };
}

export { toLocal, parse };
