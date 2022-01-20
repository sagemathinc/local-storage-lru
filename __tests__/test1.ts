import { LocalStorageLRU } from '../src/index';
test('default size', () => {
  expect(new LocalStorageLRU().getSize()).toBe(64);
});

test('set size', () => {
  expect(new LocalStorageLRU(123).getSize()).toBe(123);
});
