import { map as mapAsyncIterable } from "axax/es5/map";
import { filter as filterAsyncIterable } from "axax/es5/filter";
import { pipe as pipeAsyncIterable } from "axax/es5/pipe";
import { merge as mergeAsyncIterables } from "axax/es5/merge";
import { $$asyncIterator } from "iterall";

if(Symbol.asyncIterator === undefined) ((Symbol as any).asyncIterator) = $$asyncIterator;

export type AsyncIteratorComposeItem<T> = {
  iterator: AsyncIterator<T>;
  filter?: ((value: T) => boolean);
  map?: ((value: T) => any);
};
export function composeAsyncIterators<T>(items: Array<AsyncIteratorComposeItem<T>>): AsyncIterator<any> {
  const iterables: Array<AsyncIterable<any>> = [];
  for (const { iterator, filter, map } of items) {
    const asyncIterable: AsyncIterable<T> = Object.defineProperty({}, Symbol.asyncIterator, {
      value(): AsyncIterator<T> {
        return iterator;
      },
    });

    const pipes: Array<(iterable: AsyncIterable<T>) => any> = [];
    if (filter) {
      pipes.push(filterAsyncIterable(filter));
    }
    if (map) {
      pipes.push(mapAsyncIterable(map));
    }

    const wrappedIterable = pipeAsyncIterable(...pipes)(asyncIterable);
    iterables.push(wrappedIterable);
  }
  return mergeAsyncIterables(...iterables);
}
