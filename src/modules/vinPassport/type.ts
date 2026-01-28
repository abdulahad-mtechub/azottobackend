import gql from "graphql-tag";

export const vinPassportTypeDefs = gql`
  scalar DateTime
  scalar JSON

  type GasSettlement {
    id: ID!
    vinPassportId: ID!
    amount: Float!
    createdAt: DateTime!
    updatedAt: DateTime
    deletedAt: DateTime
    isDeleted: Boolean!
  }

  type VinPassport {
    id: ID!
    vin: String!
    gasSettlements: [GasSettlement!]!
    createdAt: DateTime!
    updatedAt: DateTime
    deletedAt: DateTime
    isDeleted: Boolean!
  }

  #######################
  # INPUT TYPES
  #######################

  input CreateVinPassportInput {
    vin: String!
    gasSettlements: [CreateGasSettlementInput!]
  }

  input UpdateVinPassportInput {
    id: ID!
    vin: String
  }

  input CreateGasSettlementInput {
    amount: Float!
  }

  input UpdateGasSettlementInput {
    id: ID!
    amount: Float
  }

  type VinPassportPayload {
    message: String!
    vinPassport: VinPassport!
  }

  type GasSettlementPayload {
    message: String!
    gasSettlement: GasSettlement!
  }


  type Query {
    getVinPassports(limit: Int, offset: Int,search:String): [VinPassport!]!
    getVinPassport(id: ID!): VinPassport!
  }

  type Mutation {
    createVinPassport(input: CreateVinPassportInput!): VinPassport!
    updateVinPassport(input: UpdateVinPassportInput!): VinPassport!
    deleteVinPassport(id: ID!): Boolean!

    createGasSettlement(vinPassportId: ID!, input: CreateGasSettlementInput!): GasSettlement!
    updateGasSettlement(input: UpdateGasSettlementInput!): GasSettlement!
    deleteGasSettlement(id: ID!): Boolean!
  }

  type Subscription {
    vinPassportNotification: VinPassportPayload!
    gasSettlementNotification: GasSettlementPayload!
  }
`;
