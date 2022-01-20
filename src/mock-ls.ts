/**
 * LocalStorageLRU
 * Copyright 2022 SageMath, Inc.
 * Licensed under the Apache License, Version 2.0
 *
 * @jest-environment jsdom
 */

// this is only used for testing!
export class MockLocalStorage {
  private data: { [key: string]: string } = {};
  private size: number;

  constructor(size = 10) {
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

  public getItem(key: string): string {
    return this.data[key];
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
