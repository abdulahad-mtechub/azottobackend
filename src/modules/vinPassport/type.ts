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

  input VinListingDocumentInput {
    title: String!
    fileUrl: String!
    fileName: String
    fileType: String
  }

  input VinListingInput {
    vin: String!
    documents: [VinListingDocumentInput!]!
  }

  type VinPublicData {
    year: Int
    make: String
    model: String
    trim: String
    engine: String
    fuelType: String
    transmission: String
    vehicleAge: Int
  }

  type MaintenanceHistoryRow {
    date: String
    vendor: String
    serviceType: String
    mileage: Int
    oilChange: Boolean
  }

  type DocExtract {
    ownershipStatus: String
    registrationNo: String
    insuranceProvider: String
    policyNumber: String
    invoiceDate: String
    vendorName: String
    serviceType: String
    oilChangeRecord: Boolean
    invoiceMileage: Int
    maintenanceHistory: [MaintenanceHistoryRow!]!
  }

  type ConditionMatrix {
    greenLight: Boolean
    collisionStatus: String
    riskColor: String
    notes: String
  }

  type ConditionEvent {
    type: String
    source: String
    severity: String
    impact: String
  }

  type FraudChecks {
    duplicateInvoice: Boolean
    mileageRollback: Boolean
    vendorVerification: Boolean
  }

  type ListingStatus {
    status: String
  }

  type VinListingResult {
    vinPublicData: VinPublicData!
    docExtract: DocExtract!
    conditionMatrix: ConditionMatrix!
    conditionEvents: [ConditionEvent!]!
    fraudChecks: FraudChecks!
    listingStatus: ListingStatus!
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
    submitVinListing(input: VinListingInput!): VinListingResult!
  }

  type Subscription {
    vinPassportNotification: VinPassportPayload!
  }
`;
