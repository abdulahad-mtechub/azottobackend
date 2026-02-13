import type { ValidationRule } from "graphql";
import { Kind, GraphQLError } from "graphql";

const MAX_DEPTH = 10;

import type { SelectionNode, FieldNode } from "graphql";

function getDepth(
  node: { selectionSet?: { selections: readonly SelectionNode[] } },
  depth: number
): number {
  let max = depth;
  if (node.selectionSet) {
    for (const sel of node.selectionSet.selections) {
      if (sel.kind === Kind.FIELD) {
        const d = getDepth(sel as FieldNode, depth + 1);
        if (d > max) max = d;
      }
      if (sel.kind === Kind.INLINE_FRAGMENT && sel.selectionSet) {
        for (const s of sel.selectionSet.selections) {
          if (s.kind === Kind.FIELD) {
            const d = getDepth(s as FieldNode, depth + 1);
            if (d > max) max = d;
          }
        }
      }
    }
  }
  return max;
}

export function depthLimitRule(maxDepth: number = MAX_DEPTH): ValidationRule {
  return (context) => {
    return {
      Document(node) {
        for (const def of node.definitions) {
          if (def.kind === Kind.OPERATION_DEFINITION && def.selectionSet) {
            for (const sel of def.selectionSet.selections) {
              if (sel.kind === Kind.FIELD) {
                const depth = getDepth(sel, 1);
                if (depth > maxDepth) {
                  context.reportError(
                    new GraphQLError(`Query exceeds maximum depth of ${maxDepth}.`)
                  );
                }
              }
            }
          }
        }
      },
    };
  };
}
