import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rank } from '../src/helper/match.helper.js';

test('rank ưu tiên textScore cao hơn', () => {
    const docs = [
        { _id: 'a', score: 1, tags: [] },
        { _id: 'b', score: 5, tags: [] },
    ];
    assert.equal(rank(docs)[0]._id, 'b');
});

test('rank cộng điểm cho tag khớp', () => {
    const docs = [
        { _id: 'a', score: 3, tags: ['rabbit'] },
        { _id: 'b', score: 4, tags: ['redis'] },
    ];
    // a: 3 + 1*2 = 5 > b: 4 → tag khớp lật thứ tự
    assert.equal(rank(docs, { tags: ['rabbit'] })[0]._id, 'a');
});

test('rank không lỗi khi thiếu score/tags', () => {
    const docs = [{ _id: 'a' }, { _id: 'b' }];
    assert.equal(rank(docs, { tags: ['x'] }).length, 2);
});
