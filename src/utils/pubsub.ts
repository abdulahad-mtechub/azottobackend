import { PubSub } from "graphql-subscriptions";
export const pubsub = new PubSub();

export const getAsyncIterator = (triggers: string | string[]) => {
  const maybeAsyncIterator =
    (
      pubsub as unknown as {
        asyncIterator?: typeof pubsub.asyncIterableIterator;
      }
    ).asyncIterator?.(triggers) ?? pubsub.asyncIterableIterator(triggers);

  if (
    !maybeAsyncIterator ||
    typeof (maybeAsyncIterator as any)[Symbol.asyncIterator] !== "function"
  ) {
    throw new Error("PubSub subscribe helper did not return an AsyncIterator");
  }

  return maybeAsyncIterator;
};
