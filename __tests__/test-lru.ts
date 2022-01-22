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

const modes = [{ fallback: false }, { fallback: true }] as const;

// we check for either direct use of LocalStorageLRU or a faulty localStorage and using a fallback
describe.each(modes)(`%s`, ({ fallback }) => {
  const mode = `fallback:${fallback}`;

  beforeEach(() => {
    localStorage.clear();
    const props = {
      ...(fallback ? { fallback, localStorage: [] as any } : undefined),
    };
    // this purposely sets a problematic local storage object, in order to let the fallback kick in
    LS = new LocalStorageLRU(props);
  });

  test(`${mode} uses fallback implementation`, () => {
    if (fallback) {
      expect(LS.getLocalStorage() instanceof LocalStorageFallback).toBe(true);
    } else {
      expect(LS.getLocalStorage() === window.localStorage).toBe(true);
    }
  });

  test(`${mode} have local storage`, () => {
    expect(LS.localStorageWorks()).toBe(true);
  });

  test(`${mode} default size`, () => {
    expect(LS.getMaxSize()).toBe(64);
  });

  test(`${mode} max size`, () => {
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

  test(`${mode} test custom recent key`, () => {
    const ls = new LocalStorageLRU({ recentKey: 'myKey' });
    ls.set('foo', '123');
    expect(localStorage['myKey']).toBe('foo');
  });

  test(`${mode} fail if trying to set with the key of the recent list`, () => {
    expect(() => LS.set('__recent', '1')).toThrow('localStorage: Key "__recent" is reserved.');
  });

  test(`${mode} fail if key contains the delimiter`, () => {
    expect(() => LS.set('\0', '1')).toThrow('localStorage: Cannot use "\0" as a character in a key');
  });

  // the delimiter is customizable
  test(`${mode} customize the delimiter string`, () => {
    const ls = new LocalStorageLRU({ delimiter: '::' });
    ls.set('foo', '1');
    ls.set('bar', '2');
    expect(localStorage['__recent']).toBe('bar::foo');
    expect(() => ls.set('1::2', '3')).toThrow('localStorage: Cannot use "::" as a character in a key');
  });

  test(`${mode} basic set/get`, () => {
    LS.set('foo', 'bar');
    expect(LS.get('foo')).toBe('bar');
  });

  // this is the first real test: it checks if after saving several items,
  // the list of recent keys is correct
  test(`${mode} recent entries after inserting`, () => {
    LS.set('foo', '1');
    LS.set('bar', '2');
    LS.set('foo', '3');
    const r = LS.getRecent();
    expect(r).toEqual(['foo', 'bar']);
  });

  // similarly, if keys are deleted, they're removed from the list of recent keys
  test(`${mode} recent entries after delete`, () => {
    LS.set('foo', '1');
    LS.set('bar', '2');
    LS.delete('foo');
    const r = LS.getRecent();
    expect(r).toEqual(['bar']);
  });

  // finally, we check if the recent list starts with the most recently *accessed* key
  test(`${mode} recently accessed`, () => {
    LS.set('foo', '1');
    LS.set('bar', '2');
    expect(LS.getRecent()).toEqual(['bar', 'foo']);
    const v = LS.get('foo');
    expect(v).toEqual('1');
    expect(LS.getRecent()).toEqual(['foo', 'bar']);
  });

  test(`${mode} trimming`, () => {
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
    expect(LS.get('key1')).toBe('1');
    expect(LS.get('key2')).toBe('2');
  });

  test(`${mode} candidate filter`, () => {
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

  test(`${mode} mockup local storage`, () => {
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

  test(`${mode} clearing`, () => {
    LS.set('foo', 'bar');
    LS.clear();
    expect(LS.get('foo')).toBe(null);
  });

  test(`${mode} localStorageTest`, () => {
    expect(LocalStorageLRU.testLocalStorage(LS.getLocalStorage())).toBe(true);
  });

  test(`${mode} getRecentKey`, () => {
    expect(LS.getRecentKey()).toBe('__recent');
  });

  test(`${mode} has`, () => {
    expect(LS.has('foo')).toBe(false);
    LS.set('foo', 'bar');
    expect(LS.has('foo')).toBe(true);
    expect(LS.has(LS.getRecentKey())).toBe(true);
  });

  test(`${mode} has recent key`, () => {
    LS.set('foo', 'bar');
    expect(LS.has(LS.getRecentKey())).toBe(true);
  });

  test(`${mode} get "null" if it does not exist`, () => {
    expect(LS.get('foo')).toBe(null);
  });

  test(`${mode} delete prefix`, () => {
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

  test(`${mode} keys`, () => {
    LS.set('key123', '1');
    LS.set('key456', '2');
    LS.set('other987', '3');
    expect(LS.keys()).toEqual(['key123', 'key456', 'other987']);
  });

  test(`${mode} for..in gives keys`, () => {
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

  test(`${mode} for..of gives [key, value] pairs`, () => {
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

  // this not only checks the values, but also if the type and other properties are really correct.
  test.each`
    key           | value                                | check
    ${'object'}   | ${{ a: 1, b: 2 }}                    | ${(v: unknown) => typeof v === 'object'}
    ${'str[]'}    | ${['a', 'b', 123, { x: 1, y: 2.2 }]} | ${(v: unknown) => Array.isArray(v)}
    ${'nested'}   | ${{ a: { b: { c: 'd' } } }}          | ${(v: unknown) => typeof v === 'object'}
    ${'number'}   | ${123}                               | ${(v: unknown) => typeof v === 'number'}
    ${'negative'} | ${-123}                              | ${(v: unknown) => typeof v === 'number'}
    ${'NaN'}      | ${NaN}                               | ${(v: unknown) => typeof v === 'number' && isNaN(v)}
    ${'a_date'}   | ${new Date(1900494000000)}           | ${(v: unknown) => v instanceof Date && v.getTime() === 1900494000000}
    ${'boolean'}  | ${true}                              | ${(v: unknown) => typeof v === 'boolean' && v === true}
    ${'null_val'} | ${null}                              | ${(v: unknown) => v === null}
    ${'bigint'}   | ${BigInt(123)}                       | ${(v: unknown) => typeof v === 'bigint' && v === BigInt(123)}
  `(`${mode} load/save types $key=$value`, ({ key, value, check }) => {
    LS.set(key, value);
    expect(LS.get(key)).toEqual(value);
    expect(check(LS.get(key))).toBe(true);
  });

  test(`${mode} check serialized object uses correct prefix`, () => {
    LS.set('object', { a: 1, b: 2 });
    const val = LS.getLocalStorage().getItem('object');
    expect(val?.slice(0, 9)).toBe('\x00\x03object\0');
  });

  test(`${mode} do not break existing string values`, () => {
    const store = LS.getLocalStorage();
    store.setItem('foo', 'bar');
    expect(LS.get('foo')).toBe('bar');
    LS.set('bar', 'foo');
    expect(store.getItem('bar')).toBe('foo');
    // even if they're serialized JSON
    const o = JSON.stringify({ a: 1, b: 2 });
    store.setItem('baz', o);
    expect(LS.get('baz')).toEqual(o);
  });

  test(`${mode} optionally, try json-parsing existing strings`, () => {
    const myLS = new LocalStorageLRU({ parseExistingJSON: true });
    const store = myLS.getLocalStorage();
    const o = { a: 1, b: 2 };
    const os = JSON.stringify(o);
    store['baz'] = os;
    const v = myLS.get('baz');
    expect(v).toEqual(o);
    expect(typeof v).toBe('object');
  });

  test(`${mode} custom serializer/deserializer`, () => {
    function ser(val: any) {
      if (Array.isArray(val)) {
        return 'arr' + val.join('\0');
      } else {
        return 'obj' + JSON.stringify(val);
      }
    }

    function toInt(i: string): number | string {
      try {
        return parseInt(i, 10);
      } catch {
        return i;
      }
    }

    function des(val: string): any {
      if (val.startsWith('arr')) {
        return val.slice(3).split('\0').map(toInt);
      } else {
        return JSON.parse(val.slice(3));
      }
    }
    const myLS = new LocalStorageLRU({ serializer: ser, deserializer: des });
    const store = myLS.getLocalStorage();
    const a = [1, 333, 2, 3];
    const o = { a: 1, b: 2 };
    myLS.set('arr', a);
    myLS.set('obj', o);
    expect(myLS.get('arr')).toEqual(a);
    expect(myLS.get('obj')).toEqual(o);
    expect(store.getItem('arr')).toBe('\x00\x03object\x00arr1\x00333\x002\x003');
    expect(store.getItem('obj')).toBe('\x00\x03object\x00obj{"a":1,"b":2}');
  });

  // in case you want to live on the edge:
  // this optimizes the used storage space: no delimiter, just one unicode char at the beginning...
  test(`${mode} custom typePrefixes and no delimiter`, () => {
    const myLS = new LocalStorageLRU({
      typePrefixDelimiter: '',
      typePrefixes: {
        date: '\x01',
        bigint: '\x02',
        object: '\x03',
        int: '\x04',
        float: '\x05',
      },
    });
    const store = myLS.getLocalStorage();
    myLS.set('obj', { a: 1, b: 2 });
    myLS.set('str', 'foo');
    myLS.set('date', new Date(123123123123));
    myLS.set('bigint', BigInt(123123123123));
    expect(myLS.get('obj')).toEqual({ a: 1, b: 2 });
    expect(myLS.get('str')).toBe('foo');
    expect(myLS.get('date')).toEqual(new Date(123123123123));
    expect(myLS.get('bigint')).toBe(BigInt(123123123123));
    expect(store.getItem('obj')).toBe('\x03{"a":1,"b":2}');
    expect(store.getItem('str')).toBe('foo');
    expect(store.getItem('date')).toBe('\x01123123123123');
    expect(store.getItem('bigint')).toBe('\x02123123123123');
  });

  // number types check
  test.each`
    key    | value                       | type
    ${'a'} | ${3.1415}                   | ${'float'}
    ${'b'} | ${1231}                     | ${'int'}
    ${'c'} | ${NaN}                      | ${'float'}
    ${'d'} | ${Infinity}                 | ${'float'}
    ${'e'} | ${Number.NEGATIVE_INFINITY} | ${'float'}
    ${'f'} | ${Number.EPSILON}           | ${'float'}
    ${'g'} | ${Number.MAX_SAFE_INTEGER}  | ${'int'}
    ${'h'} | ${Number.MIN_SAFE_INTEGER}  | ${'int'}
  `(`${mode} support numbers: $key`, ({ key, value, type }) => {
    LS.set(key, value);
    expect(LS.get(key)).toBe(value);
    const t = type === 'int' ? '\x00\x04int\x00' : '\x00\x05float\x00';
    console.log(LS.getLocalStorage().getItem(key));
    console.log(t);
    expect(LS.getLocalStorage().getItem(key)!.startsWith(t)).toBe(true);
  });
});
