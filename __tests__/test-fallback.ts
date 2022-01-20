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
  // this purposely sets a problematic local storage object, in order to let the fallback kick in
  LS = new LocalStorageLRU({ fallback: true, localStorage: [] as any });
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

test('clearing', () => {
  LS.set('foo', 'bar');
  LS.clear();
  expect(LS.get('foo')).toBe(null);
});

test('use fallback implementation', () => {
  expect(LS.getLocalStorage() instanceof LocalStorageFallback).toBe(true);
});
