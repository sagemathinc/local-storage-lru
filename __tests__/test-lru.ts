/**
 * LocalStorageLRU
 * Copyright 2022 SageMath, Inc.
 * Licensed under the Apache License, Version 2.0
 *
 * @jest-environment jsdom
 */

import { LocalStorageLRU } from '../src/index';
import { LocalStorageFallback } from '../src/mock-ls';

let LS: LocalStorageLRU;

beforeEach(() => {
  window.localStorage.clear();
  LS = new LocalStorageLRU();
});

test('have local storage', () => {
  expect(LS.localStorageWorks()).toBe(true);
});

test('default size', () => {
  expect(LS.getMaxSize()).toBe(64);
});

test('max size', () => {
  const ls = new LocalStorageLRU({ maxSize: 11 });
  expect(ls.getMaxSize()).toBe(11);
  for (let i = 0; i < 100; i++) {
    ls.set(`key${i}`, `value${i}`);
  }
  // we have 101 keys stored
  expect(ls.size()).toBe(100);
  // but recent is only 11 entries long + 1
  expect(ls.getRecent().length).toBe(11);
});

test('test custom recent key', () => {
  const ls = new LocalStorageLRU({ recentKey: 'myKey' });
  ls.set('foo', '123');
  expect(window.localStorage['myKey']).toBe('foo');
});

test('fail if trying to set with the key of the recent list', () => {
  expect(() => LS.set('__recent', '1')).toThrow('localStorage: Key "__recent" is reserved.');
});

test('fail if key contains the delimiter', () => {
  expect(() => LS.set('\0', '1')).toThrow('localStorage: Cannot use "\0" as a character in a key');
});

// the delimiter is customizable
test('customize the delimiter string', () => {
  const ls = new LocalStorageLRU({ delimiter: '::' });
  ls.set('foo', '1');
  ls.set('bar', '2');
  expect(window.localStorage['__recent']).toBe('bar::foo');
  expect(() => ls.set('1::2', '3')).toThrow('localStorage: Cannot use "::" as a character in a key');
});

test('basic set/get', () => {
  LS.set('foo', 'bar');
  expect(LS.get('foo')).toBe('bar');
});

// this is the first real test: it checks if after saving several items,
// the list of recent keys is correct
test('recent entries after inserting', () => {
  LS.set('foo', '1');
  LS.set('bar', '2');
  LS.set('foo', '3');
  const r = LS.getRecent();
  expect(r).toEqual(['foo', 'bar']);
});

// similarly, if keys are deleted, they're removed from the list of recent keys
test('recent entries after delete', () => {
  LS.set('foo', '1');
  LS.set('bar', '2');
  LS.delete('foo');
  const r = LS.getRecent();
  expect(r).toEqual(['bar']);
});

// finally, we check if the recent list starts with the most recently *accessed* key
test('recently accessed', () => {
  LS.set('foo', '1');
  LS.set('bar', '2');
  expect(LS.getRecent()).toEqual(['bar', 'foo']);
  const v = LS.get('foo');
  expect(v).toEqual('1');
  expect(LS.getRecent()).toEqual(['foo', 'bar']);
});

test('trimming', () => {
  for (let i = 0; i < 100; i++) {
    LS.set(`key${i}`, `value${i}`);
  }
  LS.set('key1', '1');
  LS.set('key2', '2');
  expect(LS.size()).toBe(100);
  LS['trimOldEntries']();
  expect(LS.size()).toBeLessThanOrEqual(100 + 1);
  expect(LS.size()).toBeGreaterThanOrEqual(100 + 1 - 10);
  expect(LS.getRecent().slice(0, 2)).toEqual(['key2', 'key1']);
  for (let i = 0; i < 101; i++) {
    LS['trimOldEntries']();
  }
  expect(LS.getRecent().slice(0, 2)).toEqual(['key2', 'key1']);
  expect(LS.size()).toBeLessThan(100 + 1 - 20);
});

test('candidate filter', () => {
  // delete anything except "key123"
  const candidate = (key: string, _: string[]) => {
    return key !== 'key123';
  };
  const ls = new LocalStorageLRU({ isCandidate: candidate, maxSize: 1 });
  ls.set('key123', '1');
  ls.set('key456', '2');
  ls.set('key789', '3');
  expect(ls.getRecent().includes('test123')).toBe(false);
  // no matter how often we trim, key123 is still there
  for (let i = 0; i < 10; i++) ls['trimOldEntries']();
  expect(ls.getRecent()).toEqual(['key789']);
  expect(ls.get('key123')).toBe('1');
});

test('mockup local storage', () => {
  const myLS = new LocalStorageFallback(10);
  const ls = new LocalStorageLRU({ localStorage: myLS, maxSize: 5 });
  expect(ls.getLocalStorage()).toBe(myLS);

  // we have to run this test many times, because recording the usage
  // of a key could cause it to be deleted before it is recorded.
  for (let trial = 0; trial < 100; trial++) {
    myLS.clear();
    for (let i = 0; i < 20; i++) {
      ls.set(`key${i}`, `value${i}`);
    }
    expect(ls.getRecent()).toEqual(['key19', 'key18', 'key17', 'key16', 'key15']);
    // last one should survive
    expect(ls.get('key19')).toBe('value19');
    // older ones not
    expect(ls.getRecent().length).toBe(4);
    expect(myLS.keys().length).toBeLessThanOrEqual(10);
  }
});

test('clearing', () => {
  LS.set('foo', 'bar');
  LS.clear();
  expect(LS.get('foo')).toBe(null);
});

test('use main implementation', () => {
  expect(LS.getLocalStorage()).toBe(window.localStorage);
});

test('localStorageTest', () => {
  expect(LocalStorageLRU.testLocalStorage(LS.getLocalStorage())).toBe(true);
});

test('getRecentKey', () => {
  expect(LS.getRecentKey()).toBe('__recent');
});

test('has', () => {
  expect(LS.has('foo')).toBe(false);
  LS.set('foo', 'bar');
  expect(LS.has('foo')).toBe(true);
  expect(LS.has(LS.getRecentKey())).toBe(true);
});

test('has recent key', () => {
  LS.set('foo', 'bar');
  expect(LS.has(LS.getRecentKey())).toBe(true);
});

test('get "null" if it does not exist', () => {
  expect(LS.get('foo')).toBe(null);
});

test('delete prefix', () => {
  LS.set('key123', '1');
  LS.set('key456', '2');
  LS.set('other987', '3');
  LS.set('key789', '4');
  LS.deletePrefix('other');
  expect(LS.has('other987')).toBe(false);
  expect(LS.has('key123')).toBe(true);
  expect(LS.get('other987')).toBe(null);
  expect(LS.get('key789')).toBe('4');
  expect(LS.size()).toBe(3);
});

test('keys', () => {
  LS.set('key123', '1');
  LS.set('key456', '2');
  LS.set('other987', '3');
  expect(LS.keys()).toEqual(['key123', 'key456', 'other987']);
});

test('for..in gives keys', () => {
  LS.set('key1', '1');
  LS.set('key2', '2');
  LS.set('key3', '3');
  const keys: string[] = [];
  for (const entry in LS.getLocalStorage()) {
    keys.push(entry);
  }
  expect(LS.getLocalStorage().length).toBe(4);
  expect(LS.keys()).toEqual(['key1', 'key2', 'key3']);
});

test('for..of gives [key, value] pairs', () => {
  LS.set('key1', '1');
  LS.set('key2', '2');
  LS.set('key3', '3');
  const entries: [string, any][] = [];
  for (const [k, v] of LS) {
    entries.push([k, v]);
  }
  // sort entries by the first element using string comparison
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  expect(LS.getLocalStorage().length).toBe(4);
  expect(LS.keys()).toEqual(['key1', 'key2', 'key3']);
  expect(entries).toEqual([
    ['key1', '1'],
    ['key2', '2'],
    ['key3', '3'],
  ]);
});

test('load/save objects as well', () => {
  const d = 1900494000000;
  const n = BigInt(12300000000000000001);
  const a = ['a', 'b', 123, { x: 1, y: 2.2 }];
  const o = { a: 1, b: 2 };
  const i = 12321;
  LS.set('object', o);
  LS.set('str[]', a);
  LS.set('number', i);
  LS.set('a date', new Date(d));
  LS.set('boolean', true);
  LS.set('null_val', null);
  LS.set('undefined', undefined);
  LS.set('bigint', n);
  // test that we can load them
  expect(LS.get('object')).toEqual(o);
  expect(typeof LS.get('object')).toBe('object');
  expect(LS.get('str[]')).toEqual(a);
  expect(Array.isArray(LS.get('str[]'))).toBe(true);
  expect(LS.get('number')).toBe(i);
  expect(typeof LS.get('number')).toBe('number');
  expect(LS.get('a date')).toEqual(new Date(d));
  expect(LS.get('a date') instanceof Date).toBe(true);
  expect(LS.get('boolean')).toBe(true);
  expect(typeof LS.get('boolean')).toBe('boolean');
  expect(LS.get('null_val')).toBe(null);
  expect(LS.get('undefined')).toBe(null); // can't store undefined
  expect(LS.get('bigint')).toBe(n);
  expect(typeof LS.get('bigint')).toBe('bigint');
});

test('check serialized object uses correct prefix', () => {
  LS.set('object', { a: 1, b: 2 });
  const val = LS.getLocalStorage().getItem('object');
  expect(val?.slice(0, 9)).toBe('__object\0');
});

test('do not break existing string values', () => {
  const store = LS.getLocalStorage();
  store['foo'] = 'bar';
  expect(LS.get('foo')).toBe('bar');
  LS.set('bar', 'foo');
  expect(store['bar']).toBe('foo');
  // even if they're serialized JSON
  const o = JSON.stringify({ a: 1, b: 2 });
  store['baz'] = o;
  expect(LS.get('baz')).toEqual(o);
});

test('optionally, try json-parsing existing strings', () => {
  const myLS = new LocalStorageLRU({ parseExistingJSON: true });
  const store = myLS.getLocalStorage();
  const o = { a: 1, b: 2 };
  const os = JSON.stringify(o);
  store['baz'] = os;
  expect(myLS.get('baz')).toEqual(o);
});
