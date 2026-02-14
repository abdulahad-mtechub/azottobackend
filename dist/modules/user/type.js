"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userTypeDefs = void 0;
const graphql_tag_1 = __importDefault(require("graphql-tag"));
exports.userTypeDefs = (0, graphql_tag_1.default) `
  scalar DateTime
  scalar JSON

  enum UserRole {
    ADMIN
    DEALER
    SELLER
    CUSTOMER
  }

  type AztoWallet {
    id: ID!
    userId: ID!
    balance: Float!
    createdAt: DateTime!
    updatedAt: DateTime
  }

  type User {
    id: ID!
    name: String
    email: String
    password: String!
    role: UserRole

    coinbaseUserId: String
    walletAddress: String 
    signature:     String

    createdAt: DateTime!
    createdBy: String
    updatedAt: DateTime
    updatedBy: String
    deletedAt: DateTime
    deletedBy: String
    isDeleted: Boolean!

    wallet: AztoWallet
    auditLogs:    [AuditLog]
    alerts:       [Alert]
    documents:    [Document]
  }

  input CreateUserInput {
    name: String!
    email: String!
    password: String!
    role: UserRole
    imageUrl: String
  }

  input UpdateUserInput {
    id: ID!
    name: String
    email: String
    password: String
    role: UserRole
    imageUrl: String
  }

  type UserCreatedPayload {
    message: String!
    user: User!
  }

    type WalletPayload {
    message: String!
    user: User!
  }

  type PaginatedUsers {
    users: [User!]!
    totalCount: Int!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  input LoginInput {
    email: String!
    password: String!
    role: UserRole
  }

  input CoinbaseWalletLoginInput {
    email: String!
    address: String!
    signature: String!
    message: String!
    timestamp: String!
  }


  input UserFilter {
    isActive: Boolean
    roles: [UserRole!]
    search: String
    startDate: DateTime
    endDate: DateTime
  }

  ########################
  # AZTO WALLET INPUTS
  ########################
  input CreateWalletInput {
    userId: ID!
    balance: Float!
  }

  input UpdateWalletInput {
    id: ID!
    balance: Float!
  }

  type Query {
    getUsers(
      limit: Int
      offset: Int
      roles: [UserRole!]
      isActive: Boolean
      search: String
      bookingsFrequency: String
    ): PaginatedUsers!
    getUser(id: ID!): User!

    getWallets(limit: Int, offset: Int): [AztoWallet!]!
    getWallet(id: ID!): AztoWallet!
    getWalletNonce(walletAddress: String!): String!
  }

  type Mutation {
    registerUser(input: CreateUserInput!): User!
    createUser(input: CreateUserInput!): User!
    updateUser(input: UpdateUserInput!): User!
    changePassword(id: ID!, oldPassword: String!, newPassword: String!): User!
    loginUser(input: LoginInput!): AuthPayload!
    connectWallet(walletAddress: String! signature:String): AuthPayload!
    coinbaseLogin(input: CoinbaseWalletLoginInput!): AuthPayload!
    deleteUser(id: ID!): Boolean!

    staffLogin(email: String, password: String!): AuthPayload!

    #####################
    # WALLET MUTATIONS
    #####################
    createWallet(input: CreateWalletInput!): AztoWallet!
    updateWallet(input: UpdateWalletInput!): AztoWallet!
    deleteWallet(id: ID!): Boolean!
  }

  type Subscription {
    userNotification: UserCreatedPayload!
    walletNotification: WalletPayload!
  }
`;
