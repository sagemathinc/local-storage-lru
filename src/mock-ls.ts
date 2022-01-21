/**
 * LocalStorageLRU
 * Copyright 2022 SageMath, Inc.
 * Licensed under the Apache License, Version 2.0
 *
 * @jest-environment jsdom
 */

// This backs the localStorage via a simple dictionary and it also has a limited size.
// It is used by @LocalStorageLRU, if fallback is true and the test if local storage works fails.
export class LocalStorageFallback {
  private data: { [key: string]: string } = {};
  private size: number;

  constructor(size = 1000) {
    this.size = size;
  }

  // number of elements in data
  public get length(): number {
    return Object.keys(this.data).length;
  }

  // clear everything in data
  public clear(): void {
    this.data = {};
  }

  public getItem(key: string): string | null {
    return this.data[key] ?? null;
  }

  public setItem(key: string, val: string): void {
    if (this.length >= this.size) {
      throw new Error('storage full');
    }
    this.data[key] = val;
  }

  public removeItem(key: string): void {
    delete this.data[key];
  }

  public key(index: number): string {
    return Object.keys(this.data)[index];
  }

  public keys(): string[] {
    return Object.keys(this.data);
  }
}
