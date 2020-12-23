import { Message } from './Message';
import { getProjectionState } from './Projection';

type Handler<Params> = {
  topics: string[];
  fn: (
    message: Message,
    params: Params,
    projections: {
      get: typeof getProjectionState;
      publish: (topic: string, payload: any, opts?: any) => void;
    }
  ) => void;
};

export function handler<Params>(
  topics: string[],
  fn: (
    message: Message,
    params: Params,
    projections: {
      get: typeof getProjectionState;
      publish: (topic: string, payload: any, opts?: any) => void;
    }
  ) => void
): Handler<Params> {
  return {
    topics,
    fn,
  };
}
