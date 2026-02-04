import gql from "graphql-tag";
import { UserRole } from "@prisma/client";

export const systemTypeDefs = gql`
  scalar DateTime

  enum SystemStateKey {
    KILL_SWITCH #stops all operations
    PAUSE_SYSTEM #pauses non-critical operations
  }

  type SystemState {
    id: ID!
    key: SystemStateKey!
    value: String!
    updatedAt: DateTime!
    updatedBy: String
  }

  type ConditionMatrix {
    id: ID!
    version: String!
    rulesHash: String!
    effectiveFrom: DateTime!
    isActive: Boolean!
    createdAt: DateTime!
    createdBy: String
  }

  input UpdateSystemStateInput {
    key: SystemStateKey!
    value: String!
    updatedBy: String
  }

  input CreateConditionMatrixInput {
    version: String!
    rulesHash: String!
    effectiveFrom: DateTime!
    isActive: Boolean
    createdBy: String
  }

  input UpdateConditionMatrixInput {
    id: ID!
    isActive: Boolean
  }

  type Query {
    getSystemStates: [SystemState!]!
    getConditionMatrices(activeOnly: Boolean): [ConditionMatrix!]!
  }

  type Mutation {
    setSystemState(key: String!, value: String!): SystemState!
    createConditionMatrix(input: CreateConditionMatrixInput!): ConditionMatrix!
    updateConditionMatrix(input: UpdateConditionMatrixInput!): ConditionMatrix!
  }
  type Subscription {
    systemStateNotification: SystemState!
  }
`;



//////////////////////////////////////
// Typescript Interfaces
//////////////////////////////////////

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  imageUrl?: string;
  role?: UserRole;
}

export interface UpdateUserInput {
  id: string;
  name?: string;
  email?: string;
  password?: string;
  imageUrl?: string;
  role?: UserRole;
}

export interface UserFilter {
  isActive?: boolean;
  roles?: UserRole[];
  search?: string;
  startDate?: string;
  endDate?: string;
}

export interface CreateWalletInput {
  userId: string;
  balance: number;
}

export interface UpdateWalletInput {
  id: string;
  balance?: number;
}