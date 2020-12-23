import { Message } from './Message';

export type Projection<Params, T> = {
  topics: string[];
  to: string | null; // Topic to publish back to, or null if client side
  state: T;
  locked: boolean;
  fn: (message: Message, params: Params, prev: T) => T;
};

export function getProjectionState<T>(projection: Projection<any, T>) {
  return projection.state;
}

export function projection<Params, T>(
  topics: string[],
  to: string | null,
  fn: (message: Message, params: Params, prev: T) => T,
  initial: T
): Projection<Params, T> {
  return {
    topics,
    to,
    state: initial,
    locked: false,
    fn,
  };
}
