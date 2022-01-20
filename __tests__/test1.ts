/**
 * LocalStorageLRU
 * Copyright 2022 SageMath, Inc.
 * Licensed under the Apache License, Version 2.0
 *
 * @jest-environment jsdom
 */

import { LocalStorageLRU } from '../src/index';
import { MockLocalStorage } from '../src/mock-ls';

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
  expect(ls.size()).toBe(101);
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

// similarly, if keys are delted, they're removed from the list of recent keys
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
  expect(LS.size()).toBe(100 + 1);
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
  console.log(`recent: ${ls.getRecent()}`);
  expect(ls.getRecent()).toEqual(['key789']);
  expect(ls.get('key123')).toBe('1');
});

test('mockup local storage', () => {
  const myls = new MockLocalStorage(10);
  const ls = new LocalStorageLRU({ localStorage: myls, maxSize: 5 });
  expect(ls.getLocalStorage()).toBe(myls);
  for (let i = 0; i < 20; i++) {
    ls.set(`key${i}`, `value${i}`);
  }
  // last one should survive
  expect(ls.get('key19')).toBe('value19');
  // older ones not
  expect(ls.get('key5')).toBe(undefined);
  expect(ls.getRecent().length).toBe(5);
  expect(Object.keys(ls.getLocalStorage()).length).toBeLessThanOrEqual(10);
});

test('clearing', () => {
  LS.set('foo', 'bar');
  LS.clear();
  expect(LS.get('foo')).toBe(null);
});
