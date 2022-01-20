/**
 * @jest-environment jsdom
 */

import { LocalStorageLRU } from '../src/index';

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
  expect(new LocalStorageLRU({ maxSize: 123 }).getMaxSize()).toBe(123);
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
