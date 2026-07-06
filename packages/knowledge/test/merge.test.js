import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deepMerge, unionBy, mergeEntry } from '../src/helper/merge.helper.js';

test('unionBy khử trùng theo giá trị, giữ thứ tự', () => {
    assert.deepEqual(unionBy(['A', 'B'], ['B', 'C']), ['A', 'B', 'C']);
});

test('unionBy so object không phụ thuộc thứ tự key', () => {
    const a = [{ from: 'A', to: 'B' }];
    const b = [
        { to: 'B', from: 'A' },
        { from: 'B', to: 'C' },
    ]; // #1 trùng dù đảo key
    assert.deepEqual(unionBy(a, b), [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
    ]);
});

test('scalar mới đè, mảng thì hợp', () => {
    const out = deepMerge({ title: 'old', tags: ['x'] }, { title: 'new', tags: ['y'] });
    assert.equal(out.title, 'new');
    assert.deepEqual(out.tags, ['x', 'y']);
});

test('merge graph: A->B->C bồi thêm nhánh B->D->C', () => {
    const old = {
        data: {
            graph: {
                nodes: ['A', 'B', 'C'],
                edges: [
                    { from: 'A', to: 'B' },
                    { from: 'B', to: 'C' },
                ],
            },
        },
    };
    const patch = {
        data: {
            graph: {
                nodes: ['A', 'B', 'D', 'C'],
                edges: [
                    { from: 'B', to: 'D' },
                    { from: 'D', to: 'C' },
                ],
            },
        },
    };
    const { data } = deepMerge(old, patch);
    assert.deepEqual(data.graph.nodes, ['A', 'B', 'C', 'D']);
    assert.deepEqual(data.graph.edges, [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
        { from: 'B', to: 'D' },
        { from: 'D', to: 'C' },
    ]);
});

test('rootcause-catalog: bồi thêm cause mới, giữ cause cũ', () => {
    const old = { data: { causes: [{ condition: 'Quota exceeded', fixCategory: 'Quota' }] } };
    const patch = { data: { causes: [{ condition: 'Rabbit deadlock', fixCategory: 'RabbitMQ' }] } };
    assert.equal(deepMerge(old, patch).data.causes.length, 2);
});

test('mergeEntry bỏ field Mongo quản lý, giữ stats cũ', () => {
    const existing = { _id: 'x', createdAt: 1, updatedAt: 2, stats: { uses: 7 }, body: 'a' };
    const out = mergeEntry(existing, { body: 'b' });
    assert.equal(out._id, undefined);
    assert.equal(out.createdAt, undefined);
    assert.equal(out.stats.uses, 7); // stats không bị patch → giữ nguyên
    assert.equal(out.body, 'b');
});
