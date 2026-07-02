import { query } from '@anthropic-ai/claude-agent-sdk';
import { configService } from '@mida/claude-config';
import { logger } from '@mida/logger';
import { createLoopControlServer } from './helper/loop-control.helper.js';
import { CONTINUE_PROMPT } from './constant/prompt.constant.js';
import { LoopConfig } from './models/loop-config.model.js';
import { LoopRun } from './models/loop-run.model.js';

const stopFlags = new Set();

async function getConfig() {
    const doc = await LoopConfig.findOne().lean();
    if (doc) return doc;
    return (await LoopConfig.create({})).toObject();
}

function setConfig(patch) {
    return LoopConfig.findOneAndUpdate({}, { $set: patch }, { new: true, upsert: true }).lean();
}

function createRun({ runKey, source, prompt, maxIterations }) {
    return LoopRun.create({
        runKey,
        source,
        prompt,
        maxIterations,
        status: 'running',
        startedAt: new Date(),
    });
}

function appendIteration(runId, iteration) {
    return LoopRun.updateOne({ _id: runId }, { $push: { iterations: iteration } });
}

function updateIteration(runId, index, patch) {
    const set = {};
    for (const [key, value] of Object.entries(patch)) set[`iterations.$.${key}`] = value;
    return LoopRun.updateOne({ _id: runId, 'iterations.index': index }, { $set: set });
}

function finishRun(runId, patch) {
    return LoopRun.updateOne({ _id: runId }, { $set: { ...patch, endedAt: new Date() } });
}

function listRuns(filter = {}, limit = 20) {
    return LoopRun.find(filter).sort({ startedAt: -1 }).limit(limit).lean();
}

function getRun(runId) {
    return LoopRun.findById(runId).lean();
}

function requestStop(runKey) {
    stopFlags.add(runKey);
}

async function run({ runKey, source, prompt, cwd, canUseTool, onEvent = () => {} }) {
    const config = await getConfig();
    if (!config.enabled) throw new Error('Loop Engineer đang bị tắt trong cấu hình');

    stopFlags.delete(runKey);
    const loopRun = await createRun({ runKey, source, prompt, maxIterations: config.maxIterations });

    let sessionId;
    let costTotal = 0;
    let status = 'running';

    for (let index = 1; index <= config.maxIterations; index++) {
        if (stopFlags.has(runKey)) {
            status = 'stopped';
            break;
        }

        const iterationPrompt = index === 1 ? prompt : CONTINUE_PROMPT;
        onEvent({ type: 'iteration_start', index, maxIterations: config.maxIterations });
        await appendIteration(loopRun._id, { index, status: 'running', startedAt: new Date() });

        const { server: loopControl, result: completion } = createLoopControlServer();
        const options = await configService.agent.buildOptions({ cwd, sessionId, canUseTool });
        options.mcpServers = { ...options.mcpServers, 'loop-control': loopControl };
        if (config.iterationMaxTurns) options.maxTurns = config.iterationMaxTurns;

        let turns = 0;
        let costUsd = 0;
        let toolCount = 0;

        try {
            const stream = query({ prompt: iterationPrompt, options });
            for await (const event of stream) {
                if (event.type === 'system' && event.subtype === 'init') {
                    sessionId = event.session_id;
                    continue;
                }
                if (event.type === 'result') {
                    turns = event.num_turns;
                    costUsd = event.total_cost_usd || 0;
                } else if (event.type === 'assistant') {
                    for (const block of event.message?.content ?? []) {
                        if (block.type === 'tool_use') toolCount++;
                    }
                }
                onEvent({ type: 'iteration_event', index, event });
            }
        } catch (err) {
            logger.error('[loop-engineer] iteration failed: ' + err.message);
            await updateIteration(loopRun._id, index, {
                status: 'error',
                endedAt: new Date(),
                summary: err.message,
            });
            onEvent({ type: 'iteration_end', index, status: 'error' });
            status = 'error';
            break;
        }

        costTotal += costUsd;
        await updateIteration(loopRun._id, index, {
            status: 'done',
            endedAt: new Date(),
            costUsd,
            turns,
            toolCount,
            summary: completion.summary,
        });
        onEvent({
            type: 'iteration_end',
            index,
            status: 'done',
            costUsd,
            turns,
            summary: completion.summary,
        });

        if (completion.done) {
            status = 'done';
            break;
        }
        if (costTotal >= config.costCeilingUsd) {
            status = 'max_reached';
            break;
        }
        if (index === config.maxIterations) {
            status = 'max_reached';
        }
    }

    stopFlags.delete(runKey);
    await finishRun(loopRun._id, { status, sessionId });
    onEvent({ type: 'done', status });
    return { status, sessionId, runId: loopRun._id };
}

export const loopEngineerService = {
    config: {
        get: getConfig,
        set: setConfig,
    },
    runs: {
        list: listRuns,
        get: getRun,
    },
    engine: {
        run,
        stop: requestStop,
    },
};
