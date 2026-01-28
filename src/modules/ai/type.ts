import { AlertAction, UserRole } from "@prisma/client";
import gql from "graphql-tag";

export const aiTypeDefs = gql`
  scalar JSON
  scalar DateTime

  enum DecisionEnum {
    ACCEPT
    REJECT
  }

  type AIQuota {
    id: ID!
    userId: ID!
    invoicesProcessed: Int!
    rejectedCount: Int!
    periodStart: DateTime!
    periodEnd: DateTime!
    user: User
  }

  type AIDecision {
    id: ID!
    entityType: String!
    entityId: String!
    model: String!
    promptHash: String!
    responseHash: String!
    decision: DecisionEnum!
    confidence: Float
    metadata: JSON
    userId: ID
    user: User
    createdAt: DateTime!
  }

  input CreateQuotaInput {
    userId: ID!
    periodStart: DateTime!
    periodEnd: DateTime!
  }

  input UpdateQuotaInput {
    id: ID!
    invoicesProcessed: Int
    rejectedCount: Int
  }

  input CreateDecisionInput {
    entityType: String!
    entityId: ID!
    model: String!
    promptHash: String!
    responseHash: String!
    decision: DecisionEnum!
    confidence: Float
    metadata: JSON
    userId: ID
  }

  input UpdateDecisionInput {
    id: ID!
    decision: DecisionEnum
    confidence: Float
    metadata: JSON
  }

  type Query {
    getAIQuotas(userId: ID): [AIQuota!]!
    getAIDecisions(userId: ID, entityId: ID): [AIDecision!]!
  }

  type Mutation {
    createAIQuota(input: CreateQuotaInput!): AIQuota!
    updateAIQuota(input: UpdateQuotaInput!): AIQuota!

    createAIDecision(input: CreateDecisionInput!): AIDecision!
    updateAIDecision(input: UpdateDecisionInput!): AIDecision!
  }
`;


export interface CreateAlertInput {
  userName: string;
  userRole: string;
  action: string;
  activity: string;
  userId?: string;
  businessId: string;
}

export interface AlertFilters {
  action?: AlertAction;
  roles?: UserRole[];
  search?: string;
  startDate?: string;
  endDate?: string;
  businessId: string;
  userId: string;
}
