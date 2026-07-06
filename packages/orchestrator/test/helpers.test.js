import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toLocal, parse } from '../src/helper/namespace.helper.js';
import { guard } from '../src/helper/guard.helper.js';

test('toLocal giữ động từ tool ở segment cuối (sau __)', () => {
    const local = toLocal({ kind: 'rabbit', cluster: 'prod' }, 'queue_publish');
    assert.equal(local, 'rabbit_prod__queue_publish');
    // đây là điều kiện để Agent SDK .split('__').pop() lấy đúng 'queue_publish'
    assert.equal(local.split('__').pop(), 'queue_publish');
});

test('toLocal đổi dấu - trong cluster thành _', () => {
    assert.equal(toLocal({ kind: 'mongo', cluster: 'shard-1' }, 'find'), 'mongo_shard_1__find');
});

test('parse tách prefix và tool', () => {
    assert.deepEqual(parse('rabbit_prod__queue_publish'), {
        prefix: 'rabbit_prod',
        tool: 'queue_publish',
    });
    assert.equal(parse('noSeparator'), null);
});

test('guard: read tool luôn qua', () => {
    assert.equal(guard.check('queue_list', 'read').allow, true);
    assert.equal(guard.check('get_stats', 'read').allow, true);
});

test('guard: write tool cần capability >= write', () => {
    assert.equal(guard.check('queue_publish', 'read').allow, false);
    assert.equal(guard.check('queue_publish', 'write').allow, true);
});

test('guard: admin tool (purge/drop) cần capability admin', () => {
    assert.equal(guard.check('queue_purge', 'write').allow, false);
    assert.equal(guard.check('queue_purge', 'admin').allow, true);
    assert.equal(guard.check('collection_drop', 'admin').allow, true);
});
