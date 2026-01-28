import gql from "graphql-tag";

export const invoiceTypeDefs = gql`
  scalar DateTime
  scalar JSON

  type NormalizedPart {
    id: ID!
    name: String!
    price: Float!
    invoiceId: ID!
    createdAt: DateTime!
    updatedAt: DateTime
    deletedAt: DateTime
    isDeleted: Boolean!
  }

  type Invoice {
    id: ID!
    number: String!
    parts: [NormalizedPart!]!
    createdAt: DateTime!
    updatedAt: DateTime
    deletedAt: DateTime
    isDeleted: Boolean!
  }

  input CreateInvoiceInput {
    number: String!
    parts: [CreatePartInput!]!
  }

  input UpdateInvoiceInput {
    id: ID!
    number: String
  }

  input CreatePartInput {
    name: String!
    price: Float!
  }

  input UpdatePartInput {
    id: ID!
    name: String
    price: Float
  }

  type InvoicePayload {
    message: String!
    user: User!
  }

  type PartPayload {
    message: String!
    user: User!
  }

  type Query {
    getInvoices(limit: Int, offset: Int,search:Int): [Invoice!]!
    getInvoice(id: ID!): Invoice!
  }

  type Mutation {
    createInvoice(input: CreateInvoiceInput!): Invoice!
    updateInvoice(input: UpdateInvoiceInput!): Invoice!
    deleteInvoice(id: ID!): Boolean!

    createPart(invoiceId: ID!, input: CreatePartInput!): NormalizedPart!
    updatePart(input: UpdatePartInput!): NormalizedPart!
    deletePart(id: ID!): Boolean!
  }
  type Subscription {
    invoiceNotification: InvoicePayload!
    partNotification: PartPayload!
  }
`;
