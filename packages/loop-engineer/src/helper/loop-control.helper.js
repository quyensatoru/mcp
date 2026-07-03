import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

export function createLoopControlServer() {
    const result = { done: false, summary: '' };

    const server = createSdkMcpServer({
        name: 'loop-control',
        tools: [
            tool(
                'loop_mark_complete',
                'Call this only when the task is fully implemented and verified — it ends the engineering loop.',
                { summary: z.string().describe('What was done and how it was verified') },
                async ({ summary }) => {
                    result.done = true;
                    result.summary = summary;
                    return { content: [{ type: 'text', text: 'Loop marked complete.' }] };
                },
            ),
        ],
    });

    return { server, result };
}
