# LRU Cache for Browser's Local Storage

## WARNING: this is an experimental implementation

## Problem

Saving an increasing number of key/value pairs in `localStorage` causes it to fill up at some point.
Then, adding/modifying throws an exception.

## Idea

Keep track of last `n` recently accessed/modified keys.
If an exception occurs,
randomly remove a few keys which aren't in that list and also – optionally – only whitelisted ones.
Then try again storing the new value.

## Benefits

- The entire overhead is _one_ additional key/value pair storing the pointers to these LRU keys.
- The keys and values you try to store are not modified.

## Usage

This is how to instantiate the wrapper class.

Options:

- `recentKey` (optional): the string of the key, under which the list of recently accessed keys is stored.
- `maxSize` (optional): the maximum number of keys to keep in the list of recently used keys. A larger list reduces the chances of deleting an "important" key, but at the same time, overall more storage is used.
- `isCandidate` (optional): a function that takes a key and returns `true` if the key is a candidate for deletion. By default, any key except for the `recentKey` is a candidate. Optional second argument is the array of all recent keys.
- `fallback` (optional, default `false`): if `true`, `localStorage` is checked if it works. If not, data is stored in a mockup storage with limited space.

```{typescript}
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

For more, check out the [tests](__tests__/test-lru.ts).

```{typescript}
storage.set('foo', 'bar');
storage.get('foo') == 'bar'; // true
```

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
