import gql from "graphql-tag";

export const blockchainTypeDefs = gql`
  scalar DateTime

  enum TxStatus {
    PENDING
    VERIFIED
    CONFIRMED
    FAILED
  }

  enum EntityType {
    VIN_PASSPORT
    CONDITION_MATRIX
    WALLET
  }

  type BlockchainTransaction {
    id: ID!
    userId: ID!
    entityType: EntityType!
    entityId: ID!
    txHash: String!
    status: TxStatus!
    createdAt: DateTime!
    updatedAt: DateTime
  }

  input CreateBlockchainTxInput {
    userId: ID!
    entityType: EntityType!
    entityId: ID!
    txHash: String!
  }

  type Query {
    getBlockchainTransactions(limit: Int, offset: Int, status: TxStatus): [BlockchainTransaction!]!
    getBlockchainTransaction(id: ID!): BlockchainTransaction!
  }

  type Mutation {
    createBlockchainTransaction(input: CreateBlockchainTxInput!): BlockchainTransaction!
    updateBlockchainTransactionStatus(id: ID!, status: TxStatus!): BlockchainTransaction!
  }
`;
