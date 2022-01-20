/**
 * LocalStorageLRU
 * Copyright [2022] SageMath, Inc.
 * Licensed under the Apache License, Version 2.0
 */

export class LocalStorageLRU {
  private size: number;
  constructor(size: number = 64) {
    this.size = size;
  }
  public getSize(): number {
    return this.size;
  }
}
