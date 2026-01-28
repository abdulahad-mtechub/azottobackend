import gql from "graphql-tag";
import { UserRole } from "@prisma/client";

export const userTypeDefs = gql`
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
    name: String!
    email: String!
    password: String!
    role: UserRole!

    createdAt: DateTime!
    createdBy: String
    updatedAt: DateTime
    updatedBy: String
    deletedAt: DateTime
    deletedBy: String
    isDeleted: Boolean!

    wallet: AztoWallet
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
    deleteUser(id: ID!): Boolean!

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