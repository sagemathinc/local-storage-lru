/**
 * LocalStorageLRU
 * Copyright 2022 SageMath, Inc.
 * Licensed under the Apache License, Version 2.0
 */

export interface TypePrefixes {
  date: string;
  bigint: string;
  object: string;
  int: string;
  float: string;
}

export interface Props {
  maxSize?: number; // how many most recently used keys are tracked
  isCandidate?: (key: string, recent: string[]) => boolean;
  recentKey?: string; // the key used to store the list of recently used keys
  delimiter?: string; // the delimiter used to separate keys in the recent list – default \0
  localStorage?: Storage; // only used for testing
  fallback?: boolean; // if true, use a memory-backed object to store the data
  serializer?: (data: any) => string; // custom serializer, default JSON.stringify
  deserializer?: (ser: string) => any; // custom de-serializer, default JSON.parse
  parseExistingJSON?: boolean; // if true, attempt to parse already existing JSON in localStorage
  typePrefixes?: TypePrefixes; // custom type prefixes
  typePrefixDelimiter?: string; // the string delimiting the type prefix and the value
}
