/**
 * LocalStorageLRU
 * Copyright 2022 SageMath, Inc.
 * Licensed under the Apache License, Version 2.0
 */

interface Props {
  maxSize?: number; // how many most recently used keys are tracked
  isCandidate?: (key: string, recent: string[]) => boolean;
  recentKey?: string; // the key used to store the list of recently used keys
  delimiter?: string; // the delimiter used to separate keys in the recent list – default \0
  localStorage?: typeof window.localStorage; // only used for testing
}

export class LocalStorageLRU {
  private readonly maxSize: number;
  private readonly isCandidate?: (key: string, recent: string[]) => boolean;
  private readonly recentKey: string;
  private readonly delimiter: string;
  private readonly ls: typeof window.localStorage;

  constructor(props?: Props) {
    this.maxSize = props?.maxSize ?? 64;
    this.isCandidate = props?.isCandidate;
    this.recentKey = props?.recentKey ?? '__recent';
    this.delimiter = props?.delimiter ?? '\0';
    this.ls = props?.localStorage ?? window.localStorage;
  }

  /**
   * the number of recent keys tracked
   */
  public getMaxSize(): number {
    return this.maxSize;
  }

  /**
   * Wrapper around localStorage, so we can safely touch it without raising an
   * exception if it is banned (like in some browser modes) or doesn't exist.
   */
  public set(key: string, val: string): void {
    if (key === this.recentKey) {
      throw new Error(`localStorage: Key "${this.recentKey}" is reserved.`);
    }
    if (key.indexOf(this.delimiter) !== -1) {
      throw new Error(`localStorage: Cannot use "${this.delimiter}" as a character in a key`);
    }
    try {
      this.ls.setItem(key, val);
    } catch (e) {
      console.log('set error', e);
      if (!this.trim(key, val)) {
        console.warn(`localStorage: set error -- ${e}`);
      }
    }
    this.recordUsage(key);
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
        console.warn(`localStorage: trimming a few entries worked`);
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
    const keys = this.ls === window.localStorage ? Object.keys(this.ls) : this.ls.keys();
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
    }
  }

  public get(key: string): string | null {
    try {
      const v = this.ls.getItem(key);
      this.recordUsage(key);
      return v;
    } catch (e) {
      console.warn(`localStorage: get error -- ${e}`);
      return null;
    }
  }

  /**
   * Deletes key from local storage
   */

  public delete(key: string): void {
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
  public localStorageWorks(): boolean {
    try {
      const TEST = '__test__';
      const timestamp = `${Date.now()}`;
      this.ls.setItem(TEST, timestamp);
      if (this.ls.getItem(TEST) !== timestamp) {
        throw new Error('localStorage: test failed');
      }
      this.ls.removeItem(TEST);
      return true;
    } catch (e) {
      return false;
    }
  }

  public size(): number {
    try {
      return this.ls.length;
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
}
