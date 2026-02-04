import gql from "graphql-tag";

export const auditLogTypeDefs = gql`
  scalar DateTime
  scalar JSON

  enum AuditAction {
    CREATE
    UPDATE
    DELETE
    LOGIN
    LOGOUT
    OTHER
  }
  
  enum EntityType {
    USER
    WALLET
    VIN_PASSPORT
    PART
    GAS_SETTLEMENT
  }

   type AuditLog {
    id: ID!
    action: AuditAction!
    entityType: EntityType!
    entityId: ID!
    oldValue: JSON
    newValue: JSON

    userId: ID
    user: User

    vinPassportId: ID
    vinPassport: VinPassport

    createdAt: DateTime!
    createdBy: String
    updatedAt: DateTime
    updatedBy: String
    deletedAt: DateTime
    deletedBy: String
    isDeleted: Boolean!
  }

  input CreateAuditLogInput {
    entityName: String!
    entityId: ID!
    action: AuditAction!
    performedBy: String!
    performedByRole: String!
    changes: JSON
  }

  input UpdateAuditLogInput {
    id:ID!
    entityName: String!
    entityId: ID!
    action: AuditAction!
    performedBy: String!
    performedByRole: String!
    changes: JSON
  }

  input AuditLogFilter {
    entityName: String
    performedBy: String
    action: AuditAction
    startDate: DateTime
    endDate: DateTime
  }

  type Query {
    getAuditLogs(limit: Int, offset: Int, filter: AuditLogFilter): [AuditLog!]!
    getAuditLog(id: ID!): AuditLog!
  }

  type Mutation {
    createAuditLog(input: CreateAuditLogInput!): AuditLog!
  }
`;

export interface AuditLogFilter {
    entityName?: string;
    performedBy?: string;
    action?: "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT" | "OTHER";
    startDate?: string;
    endDate?: string;
}