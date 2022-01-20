# LRU Cache for Browser's Local Storage

## Problem

Saving an increasing number of key/value pairs in `localStorage` causes it to fill up at some point.
Then, adding/modifying throws an exception.

## Idea

Keep track of last `n` recently accessed/modified keys.
If an exception occurs,
randomly remove a few keys which aren't in that list and also – optionally – only whitelisted ones.
Then try again storing the new value.

## Benefits

- The entire overhead is *one* additional key/value pair storing the pointers to these LRU keys.
- The keys and values you try to store are not modified.

## License

Apache 2.0


