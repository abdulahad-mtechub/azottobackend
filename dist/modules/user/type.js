"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userTypeDefs = void 0;
const apollo_server_1 = require("apollo-server");
exports.userTypeDefs = (0, apollo_server_1.gql) `
  type User {
    id: ID!
    name: String!
    email: String!
    phone: String
    createdAt: String!
    updatedAt: String!
  }

  input CreateUserInput {
    name: String!
    email: String!
    password: String!
    phone: String
  }

  type Query {
    getUsers: [User!]!
  }

  type Mutation {
    createUser(input: CreateUserInput!): User!
  }
`;
