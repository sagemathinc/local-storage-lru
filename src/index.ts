export class LocalStorageLRU {
  private size: number;
  constructor(size: number = 64) {
    this.size = size;
  }
  public getSize(): number {
    return this.size;
  }
}
