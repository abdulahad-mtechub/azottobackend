import gql from "graphql-tag";

export const vinPassportTypeDefs = gql`
  scalar DateTime
  scalar JSON

  type VinPassport {
    id: ID!
    vin: String!
    createdAt: DateTime!
    updatedAt: DateTime
    deletedAt: DateTime
    isDeleted: Boolean!
  }

  input CreateVinPassportInput {
    vin: String!
  }

  input UpdateVinPassportInput {
    id: ID!
    vin: String
  }

  type VinPassportPayload {
    message: String!
    vinPassport: VinPassport!
  }

  type Query {
    getVinPassports(limit: Int, offset: Int,search:String): [VinPassport!]!
    getVinPassport(id: ID!): VinPassport!
  }

  type Mutation {
    createVinPassport(input: CreateVinPassportInput!): VinPassport!
    updateVinPassport(input: UpdateVinPassportInput!): VinPassport!
    deleteVinPassport(id: ID!): Boolean!
  }

  type Subscription {
    vinPassportNotification: VinPassportPayload!
  }
`;
