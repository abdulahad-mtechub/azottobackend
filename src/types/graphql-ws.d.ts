declare module "graphql-ws/lib/use/ws" {
  import { Server } from "ws";
  import { ExecutionArgs, ExecutionResult, GraphQLSchema } from "graphql";

  export interface ServerOptions {
    schema: GraphQLSchema;
    execute?: (
      args: ExecutionArgs
    ) => Promise<ExecutionResult> | AsyncIterableIterator<ExecutionResult>;
    subscribe?: (
      args: ExecutionArgs
    ) => Promise<AsyncIterableIterator<ExecutionResult>>;
    onConnect?: (ctx: any) => void;
    onDisconnect?: (ctx: any) => void;
    context?: (ctx: any) => any;
  }

  export function useServer(options: ServerOptions, wsServer: Server): void;
}
