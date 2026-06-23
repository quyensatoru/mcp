import { logger } from "@mida/logger";

const hooks = {
    SessionStart: (input) => {
        logger.log('[HOOK] SessionStart — cwd:', input.cwd, 'model:', input.model);
        // save session to storage

        return {};
    },

    PreToolUse: (input) => {
        if (input.tool_name === 'Bash') {
            const cmd = input.tool_input?.command ?? '';
            if (/rm\s+-rf/.test(cmd)) {
                logger.warn('[HOOK] Blocked dangerous command:', cmd);
                return { permissionDecision: 'deny', reason: 'rm -rf is not allowed' };
            }
        }
        return {};
    },

    PostToolUse: (input) => {
        logger.log(`[HOOK] PostToolUse: ${input.tool_name} →`, input.tool_output?.slice?.(0, 120));
        return {};
    },

    PermissionRequest: (input) => {
        const { tool_name, tool_input } = input;
        logger.log(
            `[HOOK] Permission request for '${tool_name}':`,
            JSON.stringify(tool_input).slice(0, 80),
        );
        return { permissionDecision: 'allow' };
    },
};
