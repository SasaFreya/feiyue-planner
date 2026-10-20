import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveEntries, canUndo } from '../lib/planner-model.ts';

test('moving an inbox reminder into a time slot keeps its completion state and allows undo', () => {
 const source='2026-09-28:inbox:0', target='2026-10-01:time:9';
 const entries={[source]:{text:'重要提醒',done:true}};
 const move=moveEntries(entries,source,target);
 assert.deepEqual(move.after[target],entries[source]);
 assert.deepEqual(move.after[source],{text:'',done:false});
 assert.ok(canUndo({...entries,...move.after},move));
 assert.deepEqual({...entries,...move.after,...move.before}[source],entries[source]);
});
test('an occupied destination swaps instead of overwriting either task', () => {
 const entries={a:{text:'第一项',done:false},b:{text:'第二项',done:true}};
 const move=moveEntries(entries,'a','b');
 assert.deepEqual(move.after,{a:entries.b,b:entries.a});
 assert.deepEqual(entries.a,{text:'第一项',done:false});
});
test('undo never replaces edits made after a move', () => {
 const move=moveEntries({a:{text:'事项',done:false}},'a','b');
 assert.equal(canUndo({...move.after,b:{text:'新的修改',done:false}},move),false);
});
test('dropping on itself or picking up an empty cell cannot clear a task', () => {
 assert.equal(moveEntries({a:{text:'',done:false},b:{text:'保留',done:false}},'a','b'),null);
 assert.equal(moveEntries({a:{text:'保留',done:false}},'a','a'),null);
});
