/**
 * LocalStorageLRU
 * Copyright 2022 SageMath, Inc.
 * Licensed under the Apache License, Version 2.0
 */

// declare window.localStorage for node.js
declare const window: { localStorage: Storage };

import { LocalStorageFallback } from './local-storage-fallback';
import { Props, TypePrefixes } from './types';

// additionally, each one of them gets `typePrefixDelimiter` as a postfix,
// to further distinguish them from other (pure string) values.
const DEFAULT_TYPE_PREFIXES: TypePrefixes = {
  date: '\x00\x01date',
  bigint: '\x00\x02bigint',
  object: '\x00\x03object',
  int: '\x00\x04int',
  float: '\x00\x05float',
} as const;

/**
 * Use an instance of this class to access localStorage – instead of using it directly.
 * You will no longer end up with random exceptions upon setting a key/value pair.
 * Instead, if there is a problem, it will remove a few entries and tries setting the value again.
 * Recently used entries won't be removed and you can also specify a function to filter potential candidates for deletion.
 *
 * **Important** do not use index accessors – use `get` and `set` instead.
 */
export class LocalStorageLRU {
  private readonly maxSize: number;
  private readonly isCandidate?: (key: string, recent: string[]) => boolean;
  private readonly recentKey: string;
  private readonly delimiter: string;
  private readonly ls: Storage;
  private readonly serializer: (data: any) => string;
  private readonly deserializer: (ser: string) => any;
  private readonly typePrefixes: TypePrefixes;
  private readonly typePrefixDelimiter: string;
  private readonly parseExistingJSON: boolean;

  /**
   * You can tweak several details of the behavior of this class, check out {@link Props} for more information.
   *
   * By default, no tweaking is required.
   */
  constructor(props?: Props) {
    this.maxSize = props?.maxSize ?? 64;
    this.isCandidate = props?.isCandidate;
    this.recentKey = props?.recentKey ?? '__recent';
    this.delimiter = props?.delimiter ?? '\0';
    this.serializer = props?.serializer ?? JSON.stringify;
    this.deserializer = props?.deserializer ?? JSON.parse;
    this.parseExistingJSON = props?.parseExistingJSON ?? false;
    this.typePrefixDelimiter = props?.typePrefixDelimiter ?? '\0';
    this.typePrefixes = this.preparePrefixes(props?.typePrefixes);
    this.checkPrefixes();
    this.ls = this.initLocalStorage(props);
  }

  private initLocalStorage(props?: Props): Storage {
    const { fallback = false, localStorage } = props ?? {};

    let lsProposed: Storage | undefined;
    try {
      lsProposed = localStorage ?? window?.localStorage;
    } catch {}

    if (lsProposed != null) {
      if (fallback && !LocalStorageLRU.testLocalStorage(lsProposed)) {
        return new LocalStorageFallback(1000);
      }
      return lsProposed;
    } else {
      return new LocalStorageFallback(1000);
    }
  }

  private preparePrefixes(typePrefixes?: TypePrefixes): TypePrefixes {
    const delim = this.typePrefixDelimiter;
    return {
      date: `${typePrefixes?.date ?? DEFAULT_TYPE_PREFIXES.date}${delim}`,
      bigint: `${typePrefixes?.bigint ?? DEFAULT_TYPE_PREFIXES.bigint}${delim}`,
      object: `${typePrefixes?.object ?? DEFAULT_TYPE_PREFIXES.object}${delim}`,
      int: `${typePrefixes?.int ?? DEFAULT_TYPE_PREFIXES.int}${delim}`,
      float: `${typePrefixes?.float ?? DEFAULT_TYPE_PREFIXES.float}${delim}`,
    };
  }

  private checkPrefixes() {
    // during init, we check that all values of typePrefixes are unique
    const prefixes = Object.values(this.typePrefixes);
    const uniqueValues = new Set(prefixes);
    if (prefixes.length !== uniqueValues.size) {
      throw new Error('all type prefixes must be distinct');
    }
  }

  /**
   * the number of recent keys tracked
   */
  public getMaxSize(): number {
    return this.maxSize;
  }

  /**
   * specific types are serialized with a prefix, while plain strings are stored as they are.
   */
  private serialize(val: unknown): string {
    if (typeof val === 'string') {
      return val;
    } else if (Number.isInteger(val)) {
      return `${this.typePrefixes.int}${val}`;
    } else if (typeof val === 'number') {
      return `${this.typePrefixes.float}${val}`;
    } else if (val instanceof Date) {
      return `${this.typePrefixes.date}${val.valueOf()}`;
    } else if (typeof val === 'bigint') {
      return `${this.typePrefixes.bigint}${val.toString()}`;
    } else if (val === undefined) {
      return `${this.typePrefixes.object}${this.serializer(null)}`;
    }
    return `${this.typePrefixes.object}${this.serializer(val)}`;
  }

  /**
   * Each value in localStorage is a string. For specific prefixes,
   * this deserializes the value. As a fallback, it optionally tries
   * to use JSON.parse. If everything fails, the plain string value is returned.
   */
  private deserialize(ser: string | null): any {
    if (ser === null) {
      return null;
    }

    try {
      if (ser.startsWith(this.typePrefixes.object)) {
        const s = ser.slice(this.typePrefixes.object.length);
        try {
          return this.deserializer(s);
        } catch {
          return s;
        }
      } else if (ser.startsWith(this.typePrefixes.int)) {
        const s = ser.slice(this.typePrefixes.int.length);
        try {
          return parseInt(s, 10);
        } catch {
          return s;
        }
      } else if (ser.startsWith(this.typePrefixes.float)) {
        const s = ser.slice(this.typePrefixes.float.length);
        try {
          return parseFloat(s);
        } catch {
          return s;
        }
      } else if (ser.startsWith(this.typePrefixes.date)) {
        const tsStr = ser.slice(this.typePrefixes.date.length);
        try {
          return new Date(parseInt(tsStr, 10));
        } catch {
          return tsStr; // we return the string if we can't parse it
        }
      } else if (ser.startsWith(this.typePrefixes.bigint)) {
        const s = ser.slice(this.typePrefixes.bigint.length);
        try {
          return BigInt(s);
        } catch {
          return s;
        }
      }
    } catch {}

    // optionally, it tries to parse existing JSON values – they'll be stored with a prefix when saved again
    if (this.parseExistingJSON) {
      try {
        if (this.deserialize !== JSON.parse) {
          return this.deserialize(ser);
        }
      } catch {}
      try {
        return JSON.parse(ser);
      } catch {}
    }

    // most likely a plain string
    return ser;
  }

  /**
   * Wrapper around localStorage, so we can safely touch it without raising an
   * exception if it is banned (like in some browser modes) or doesn't exist.
   */
  public set(key: string, val: unknown): void {
    if (key === this.recentKey) {
      throw new Error(`localStorage: Key "${this.recentKey}" is reserved.`);
    }
    if (key.indexOf(this.delimiter) !== -1) {
      throw new Error(`localStorage: Cannot use "${this.delimiter}" as a character in a key`);
    }

    const valSer = this.serialize(val);

    // we have to record the usage of the key first!
    // otherwise, setting it first and then updating the list of recent keys
    // could delete that very key upon updating the list of recently used keys.
    this.recordUsage(key);

    try {
      this.ls.setItem(key, valSer);
    } catch (e) {
      console.log('set error', e);
      if (!this.trim(key, valSer)) {
        console.warn(`localStorage: set error -- ${e}`);
      }
    }
  }

  public get(key: string): string | object | null {
    try {
      const v = this.ls.getItem(key);
      this.recordUsage(key);
      return this.deserialize(v);
    } catch (e) {
      console.warn(`localStorage: get error -- ${e}`);
      return null;
    }
  }

  public has(key: string): boolean {
    // we don't call this.get, because we don't want to record the usage
    return this.ls.getItem(key) != null;
  }

  /**
   * Keys of last recently used entries. The most recent one comes first!
   */
  public getRecent(): string[] {
    try {
      return this.ls.getItem(this.recentKey)?.split(this.delimiter) ?? [];
    } catch {
      return [];
    }
  }

  public getRecentKey(): string {
    return this.recentKey;
  }

  /**
   * avoid trimming more useful entries, we keep an array of recently modified keys
   */
  private recordUsage(key: string) {
    try {
      let keys: string[] = this.getRecent();
      // first, only keep most recent entries, and leave one slot for the new one
      keys = keys.slice(0, this.maxSize - 1);
      // if the key already exists, remove it
      keys = keys.filter((el) => el !== key);
      // finally, insert the current key at the beginning
      keys.unshift(key);
      const nextRecentUsage = keys.join(this.delimiter);
      try {
        this.ls.setItem(this.recentKey, nextRecentUsage);
      } catch {
        this.trim(this.recentKey, nextRecentUsage);
      }
    } catch (e) {
      console.warn(`localStorage: unable to record usage of '${key}' -- ${e}`);
    }
  }

  /**
   * remove a key from the recently used list
   */
  private deleteUsage(key: string) {
    try {
      let keys: string[] = this.getRecent();
      // we only keep those keys, which are different from the one we removed
      keys = keys.filter((el) => el !== key);
      this.ls.setItem(this.recentKey, keys.join(this.delimiter));
    } catch (e) {
      console.warn(`localStorage: unable to delete usage of '${key}' -- ${e}`);
    }
  }

  /**
   * Trim the local storage in case it is too big.
   * In case there is an error upon storing a value, we assume we hit the quota limit.
   * Try a couple of times to delete some entries and saving the key/value pair.
   */
  private trim(key: string, val: string): boolean {
    // we try up to 10 times to remove a couple of key/values
    for (let i = 0; i < 10; i++) {
      this.trimOldEntries();
      try {
        this.ls.setItem(key, val);
        // no error means we were able to set the value
        // console.info(`localStorage: trimming a few entries worked`);
        return true;
      } catch (e) {}
    }
    console.warn(`localStorage: trimming did not help`);
    return false;
  }

  // delete a few keys (not recently used and only of a specific type).
  private trimOldEntries() {
    if (this.size() === 0) return;
    // delete a maximum of 10 entries
    let num = Math.min(this.size(), 10);
    const keys = this.keys();
    // only get recent once, more efficient
    const recent = this.getRecent();
    // attempt deleting those entries up to 20 times
    for (let i = 0; i < 20; i++) {
      const candidate = keys[Math.floor(Math.random() * keys.length)];
      if (candidate === this.recentKey) continue;
      if (recent.includes(candidate)) continue;
      if (this.isCandidate != null && !this.isCandidate(candidate, recent)) continue;
      // do not call this.delete, could cause a recursion
      try {
        this.ls.removeItem(candidate);
      } catch (e) {
        console.warn(`localStorage: trimming/delete does not work`);
        return;
      }
      num -= 1;
      if (num <= 0) return;
      if (this.size() === 0) return;
    }
  }

  /**
   * Return all keys in local storage, optionally sorted.
   *
   * @param {boolean} [sorted=false]
   * @return {string[]}
   */
  public keys(sorted = false): string[] {
    const keys = this.ls instanceof LocalStorageFallback ? this.ls.keys() : Object.keys(this.ls);
    const filteredKeys: string[] = keys.filter((el: string) => el !== this.recentKey);
    if (sorted) filteredKeys.sort();
    return filteredKeys;
  }

  /**
   * Deletes key from local storage
   *
   * Throws an error only if you try to delete the reserved key to record recent entries.
   */

  public delete(key: string): void {
    if (key === this.recentKey) {
      throw new Error(`localStorage: Key "${this.recentKey}" is reserved.`);
    }
    try {
      this.deleteUsage(key);
      this.ls.removeItem(key);
    } catch (e) {
      console.warn(`localStorage: delete error -- ${e}`);
    }
  }

  /**
   * Returns true, if we can store something in local storage at all.
   */
  public localStorageIsAvailable(): boolean {
    return LocalStorageLRU.testLocalStorage(this.ls);
  }

  /**
   * Returns true, if we can store something in local storage at all.
   * This is used for testing and during initialization.
   *
   * @static
   * @param {Storage} ls
   */
  public static testLocalStorage(ls: {
    getItem: (key: string) => string | null;
    setItem: (k: string, v: string) => void;
    removeItem: (k: string) => void;
  }): boolean {
    try {
      const TEST = '__test__';
      const timestamp = `${Date.now()}`;
      ls.setItem(TEST, timestamp);
      if (ls.getItem(TEST) !== timestamp) {
        throw new Error('localStorage: test failed');
      }
      ls.removeItem(TEST);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * number of items stored in the local storage – not counting the "recent key" itself
   */
  public size(): number {
    try {
      const v = this.ls.length;
      if (this.has(this.recentKey)) {
        return v - 1;
      } else {
        return v;
      }
    } catch (e) {
      return 0;
    }
  }

  /**
   * calls `localStorage.clear()` and returns true if it worked – otherwise false.
   */
  public clear(): boolean {
    try {
      this.ls.clear();
      return true;
    } catch (e) {
      console.warn(`localStorage: clear error -- ${e}`);
      return false;
    }
  }

  public getLocalStorage() {
    return this.ls;
  }

  /** Delete all keys with the given prefix */
  public deletePrefix(prefix: string): void {
    this.keys()
      .filter((k) => k.startsWith(prefix) && k !== this.recentKey)
      .forEach((k) => this.delete(k));
  }

  /**
   * Usage:
   *
   * ```ts
   * const entries: [string, any][] = [];
   * for (const [k, v] of storage) {
   *    entries.push([k, v]);
   * }
   * entries; // equals: [[ 'key1', '1' ], [ 'key2', '2' ], ... ]
   * ```
   *
   * @returns iterator over key/value pairs
   */
  public *[Symbol.iterator](): IterableIterator<[string, string | object]> {
    for (const k of this.keys()) {
      if (k === this.recentKey) continue;
      if (k == null) continue;
      const v = this.get(k);
      if (v == null) continue;
      yield [k, v];
    }
  }

  /**
   *  Set data in nested objects and merge with existing values
   */
  public setData(key: string, pathParam: string | string[], value: any): void {
    const path = typeof pathParam === 'string' ? [pathParam] : pathParam;
    const next = this.get(key) ?? {};
    if (typeof next !== 'object') throw new Error(`localStorage: setData: ${key} is not an object`);
    function setNested(val: any, pathNested: string[]) {
      if (pathNested.length === 1) {
        // if value is an object, we merge it with the existing value
        if (typeof value === 'object') {
          val[pathNested[0]] = { ...val[pathNested[0]], ...value };
        } else {
          val[pathNested[0]] = value;
        }
      } else {
        val[pathNested[0]] = val[pathNested[0]] ?? {};
        setNested(val[pathNested[0]], pathNested.slice(1));
      }
    }
    setNested(next, path);
    this.set(key, next);
  }

  /**
   *  Get data from a nested object
   */
  public getData(key: string, pathParam: string | string[]): any {
    const path = typeof pathParam === 'string' ? [pathParam] : pathParam;
    const next: any = this.get(key);
    if (next == null) return null;
    if (typeof next !== 'object') throw new Error(`localStorage: getData: ${key} is not an object`);
    function getNested(val: any, pathNested: string[]): any {
      if (pathNested.length === 1) {
        return val[pathNested[0]];
      } else {
        return getNested(next[pathNested[0]], pathNested.slice(1));
      }
    }
    return getNested(next, path);
  }

  /**
   * Delete a value or nested object from within a nested object at the given path.
   * It returns the deleted object.
   */
  public deleteData(key: string, pathParam: string | string[]): any {
    const path: string[] = typeof pathParam === 'string' ? [pathParam] : pathParam;
    const next: any = this.get(key);
    if (next == null) return null;
    if (typeof next !== 'object') throw new Error(`localStorage: ${key} is not an object`);

    function deleteNested(val: any, pathNested: string[]) {
      if (pathNested.length === 1) {
        const del = val[pathNested[0]];
        delete val[pathNested[0]];
        return del;
      } else {
        deleteNested(val[pathNested[0]], pathNested.slice(1));
      }
    }

    const deleted = deleteNested(next, path);
    this.set(key, next);
    return deleted;
  }
}
