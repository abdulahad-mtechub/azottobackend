import gql from "graphql-tag";
import { UserRole } from "@prisma/client";

export const blockchainTypeDefs = gql`
  scalar JSON
  scalar DateTime

  enum TransactionStatus {
    PENDING
    CONFIRMED
    FAILED
  }

  type BlockchainTransaction {
    id: ID!
    chain: String!
    contract: String!
    txHash: String!
    blockNumber: Int!
    eventName: String!
    status: TransactionStatus!
    entityType: String!
    entityId: ID!
    payload: JSON!
    confirmations: Int!
    userId: ID
    user: User
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type OnChainProof {
    id: ID!
    entityType: String!
    entityId: ID!
    hash: String!
    algorithm: String!
    chain: String!
    contract: String!
    txHash: String!
    invoiceId: ID
    invoice: Invoice
    vinPassportId: ID
    vinPassport: VinPassport
    createdAt: DateTime!
  }

  input CreateBlockchainTransactionInput {
    chain: String!
    contract: String!
    txHash: String!
    blockNumber: Int!
    eventName: String!
    status: TransactionStatus!
    entityType: String!
    entityId: ID!
    payload: JSON!
    confirmations: Int
    userId: ID
  }

  input UpdateBlockchainTransactionInput {
    id: ID!
    status: TransactionStatus
    confirmations: Int
  }

  input CreateOnChainProofInput {
    entityType: String!
    entityId: ID!
    hash: String!
    algorithm: String!
    chain: String!
    contract: String!
    txHash: String!
    invoiceId: ID
    vinPassportId: ID
  }

  input UpdateOnChainProofInput {
    id: ID!
    hash: String
    algorithm: String
  }

  type Query {
    getBlockchainTransactions(userId: ID, entityId: ID): [BlockchainTransaction!]!
    getOnChainProofs(entityType: String, entityId: ID): [OnChainProof!]!
  }

  type Mutation {
    createBlockchainTransaction(input: CreateBlockchainTransactionInput!): BlockchainTransaction!
    updateBlockchainTransaction(input: UpdateBlockchainTransactionInput!): BlockchainTransaction!

    createOnChainProof(input: CreateOnChainProofInput!): OnChainProof!
    updateOnChainProof(input: UpdateOnChainProofInput!): OnChainProof!
  }
  type BlockchainNotification {
    event: String!
    transaction: BlockchainTransaction
    proof: OnChainProof
  }
  type Subscription {
    blockchainNotification: BlockchainNotification!
    blockchainproofNotification: BlockchainNotification!
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