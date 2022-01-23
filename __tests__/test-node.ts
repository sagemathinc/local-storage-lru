/**
 * LocalStorageLRU
 * Copyright 2022 SageMath, Inc.
 * Licensed under the Apache License, Version 2.0
 *
 * @jest-environment node
 */

// we also check that we can instantiate and use this class in node.js – although it is intended for the browser

import { LocalStorageLRU } from '../src';

test('confirm node mode', () => {
  expect(global['document']).toBeUndefined();
});

test('it can be loaded by node.js', () => {
  const ls = new LocalStorageLRU();
  ls.set('foo', 'bar');
  expect(ls.getLocalStorage().length).toBe(2);
  expect(ls.get('foo')).toBe('bar');
  for (let i = 0; i < 101; i++) {
    ls.set(`key${i}`, `value${i}`);
  }
  expect(ls.size()).toBe(102);
  for (let i = 0; i < 10; i++) {
    ls['trimOldEntries']();
    if (ls.size() < 100) break;
  }
  expect(ls.size()).toBeLessThan(100);
  expect(ls.getRecentKey().length).toBeLessThan(100);
});
