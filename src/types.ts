/**
 * LocalStorageLRU
 * Copyright 2022 SageMath, Inc.
 * Licensed under the Apache License, Version 2.0
 */

/**
 * specify all prefixes as strings, they must be distinct from each other. pure "string" objects are stored without a prefix.
 */
export interface TypePrefixes {
  date: string;
  bigint: string;
  object: string;
  int: string;
  float: string;
}

export interface Props {
  /**
   * how many most recently used keys are tracked – i.e. the number of tracked recently used objects.
   *
   * @default 64
   */
  maxSize?: number;
  /**
   * A function preventing certain keys from being removed – i.e. only if it returns true, that key is a candidate for removal.
   * Use it to prevent keys from being removed if they are "more important" than others.
   */
  isCandidate?: (key: string, recent: string[]) => boolean;
  /**
   *  the key used to store the list of recently used keys
   */
  recentKey?: string;
  /**
   * the delimiter used to separate keys in the recent list
   *
   * @default "\0"
   */
  delimiter?: string;
  /** only used for testing */
  localStorage?: Storage;
  /** if true, use a memory-backed fallback store, if a check test of `localStorage` fails */
  fallback?: boolean;
  /**
   * bring your own custom object serializer – must have corresponding a counterpart {@link deserializer}
   *
   * @default JSON.stringify
   */
  serializer?: (data: any) => string;
  /**
   * corresponding to {@link serializer} custom de-serializer
   *
   * @default JSON.parse
   */
  deserializer?: (ser: string) => any;
  /**
   * if true, attempt to parse already existing JSON in localStorage
   */
  parseExistingJSON?: boolean;
  /**
   * custom type prefixes
   */
  typePrefixes?: TypePrefixes;
  /**
   * a common string delimiting the type prefix and the value, could be an empty string.
   *
   * @default "\0"
   */
  typePrefixDelimiter?: string;
}
