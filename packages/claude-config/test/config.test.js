import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encrypt, decrypt } from '../src/helper/crypto.helper.js';
import { buildDefaults } from '../src/constant/defaults.constant.js';

// getKey() reads process.env at call time, so toggling the env between tests is enough.
test('crypto: encrypts + round-trips when CONSOLE_MASTER_KEY is set', () => {
    process.env.CONSOLE_MASTER_KEY = 'unit-test-master-key';
    const e = encrypt('s3cr3t-value');
    assert.equal(e.encrypted, true);
    assert.notEqual(e.value, 's3cr3t-value');
    assert.equal(decrypt(e), 's3cr3t-value');
});

test('crypto: stores plaintext when no master key', () => {
    delete process.env.CONSOLE_MASTER_KEY;
    const e = encrypt('plain');
    assert.equal(e.encrypted, false);
    assert.equal(decrypt(e), 'plain');
});

test('defaults: shape + system prompt + secret filtering', () => {
    const d = buildDefaults({
        CLAUDE_MODEL: 'claude-sonnet-4-6',
        MIDA_MCP_URL: 'http://localhost:3000/mcp',
        GITLAB_TOKEN: 'glpat-x',
    });

    assert.equal(d.agent.model, 'claude-sonnet-4-6');
    assert.equal(d.agent.permissionMode, 'acceptEdits');
    assert.equal(d.agent.disallowedTools.length, 3);
    assert.ok(d.agent.systemPromptAppend.includes('mida-rca'));

    assert.equal(d.mcpServers.length, 6);
    assert.ok(d.mcpServers.find((s) => s.name === 'mida-rca').enabled, 'enabled when URL present');
    assert.ok(!d.mcpServers.find((s) => s.name === 'figma').enabled, 'disabled without token');

    // gitlab API url derived from base url
    const gitlab = d.mcpServers.find((s) => s.name === 'gitlab');
    assert.ok(gitlab.env.find((e) => e.name === 'GITLAB_API_URL').value.endsWith('/api/v4'));

    // only non-empty secrets are present for seeding
    assert.ok(d.secrets.MIDA_MCP_URL);
    assert.ok(d.secrets.GITLAB_TOKEN);
});

test('mcp server env maps secretKey references, not literal values', () => {
    const d = buildDefaults({ FIGMA_API_TOKEN: 'figd_x' });
    const figma = d.mcpServers.find((s) => s.name === 'figma');
    const entry = figma.env.find((e) => e.name === 'FIGMA_API_KEY');
    assert.equal(entry.secretKey, 'FIGMA_API_TOKEN');
    assert.equal(entry.value, undefined);
});
