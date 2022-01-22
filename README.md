# LRU Cache for Browser's Local Storage

[![npm version](https://badge.fury.io/js/@cocalc%2Flocal-storage-lru.svg)](https://badge.fury.io/js/@cocalc%2Flocal-storage-lru)
![Statements](https://img.shields.io/badge/statements-84.5%25-yellow.svg?style=flat)
![Branches](https://img.shields.io/badge/branches-87.08%25-yellow.svg?style=flat)
![Functions](https://img.shields.io/badge/functions-100%25-brightgreen.svg?style=flat)
![Lines](https://img.shields.io/badge/lines-83.98%25-yellow.svg?style=flat)

## WARNING: this is an experimental implementation

## Problem

Saving an increasing number of key/value pairs in `localStorage` causes it to fill up at some point.
From that point on, adding/modifying throws an exception.

## Solution

Keep track of last `n` recently accessed/modified keys.
If an exception occurs,
randomly remove a few keys which aren't in that list and also – optionally – only whitelisted ones.
Then try again storing the new value.

### Benefits

- The entire overhead is _one_ additional key/value pair storing the pointers to these LRU keys.
- The keys and values you try to store are not modified.

## Design Goals

- **robust**: no exceptions are thrown (only if there is a problematic key)
- **universal**: also supports storing objects, `Date`, `BigInt`, arrays etc..
- **backwards compatible**: if you already store string values, they're not modified. You can even tell it to attempt parsing existing JSON values.

## Usage

This is how to instantiate the wrapper class.

Options:

- `recentKey` (optional): the string of the key, under which the list of recently accessed keys is stored.
- `maxSize` (optional): the maximum number of keys to keep in the list of recently used keys. A larger list reduces the chances of deleting an "important" key, but at the same time, overall more storage is used.
- `isCandidate` (optional): a function that takes a key and returns `true` if the key is a candidate for deletion. By default, any key except for the `recentKey` is a candidate. Optional second argument is the array of all recent keys.
- `fallback` (optional, default `false`): if `true`, `localStorage` is checked if it works. If not, data is stored in a mockup storage with limited space.
- `serializer` (optional): by default `JSON.stringify`, but you can use your own.
- `deserializer` (optional): counterpart to the above, by default `JSON.parse`.
- `parseExistingJSON` (optional): if `true`, it tries to deserialize already existing JSON values.
- `typePrefixes` (optional): prefixes to serialized values if they're not stored a strings – somehow, we have to mark values if they are a complex object...
- `typePrefixDelimiter` (optional): string appended to each `typePrefix` to separate from the serialized value – default: `\0`

```{javascript}
// simple:
const storage = new LocalStorageLRU();

// with options:
function candidate(key: string): boolean {
  if (key.startsWith('preserved-')) {
    return false;
  }
  return true;
}

const storage = new LocalStorageLRU({
  recentKey: RECENTLY_KEY,
  maxSize: RECENTLY_KEEP,
  isCandidate: candidate,
  fallback: true,
});
```

```{javascript}
// set/get/delete
storage.set('foo', 'bar');
storage.get('foo') == 'bar'; // true
storage.delete('foo');

// iterate
storage.set('key1', '1');
storage.set('key2', '2');
storage.set('key3', '3');
const entries: [string, any][] = [];
for (const [k, v] of storage) {
  entries.push([k, v]);
}
entries // equals: [[ 'key1', '1' ], [ 'key2', '2' ], [ 'key3', '3' ]]
```

For more, check out the [tests](__tests__/test-lru.ts).

## Development

The setup follows this [step-by-step guide](https://itnext.io/step-by-step-building-and-publishing-an-npm-typescript-package-44fe7164964c).

## Release

There are some hooks registered, see link above, to check for clean git tree, all tests passing and linting.

```{bash}
npm version patch
npm publish
```

## License

[Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0.html)
