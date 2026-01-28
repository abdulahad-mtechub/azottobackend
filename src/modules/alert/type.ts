import { AlertAction, UserRole } from "@prisma/client";
import gql from "graphql-tag";

export const alertTypeDefs = gql`
  scalar DateTime

  input AlertFilters {
    action: AlertAction
    roles: [UserRole!]
    search: String
    startDate: String
    endDate: String
    businessId: String
    string: String
  }

  enum AlertAction {
    CREATE
    UPDATE
    DELETE
    EXPORT
    IMPORT
    LOGIN
    LOGOUT
    EDIT
    REQUEST
    CHANGE_STATUS
    CONTACTED
    RENEW
    MAINTENANCE_MODE
  }

  type Alert {
    id: ID!
    userName: String!
    userRole: UserRole!
    action: AlertAction!
    activity: String!
    isRead: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
    userId: String
    businessId: String
  }

  type PaginatedAlerts {
    alerts: [Alert!]!
    totalCount: Int!
    unreadCount: Int!
  }

  input CreateAlertInput {
    userName: String!
    userRole: UserRole!
    action: AlertAction!
    activity: String!
    userId: String
  }

  type Query {
    getAlerts(
      limit: Int!
      offset: Int!
      filters: AlertFilters
    ): PaginatedAlerts!
    getAlert(id: ID!): Alert
    getUnreadAlertsCount: Int!
    getUserUnreadAlertsCount(userId: ID!): Int!
    getUserAlerts(userId: ID! limit: Int! offset: Int!): PaginatedAlerts!
  }
  type Mutation {
    createAlert(input: CreateAlertInput!): Alert!
    markAlertAsRead(id: ID!): Alert!
    markAllAlertsAsRead: Int!
    deleteAlert(id: ID!): Alert!
  }
  type AlertCreatedPayload {
    message: String!
    alert: Alert!
  }

  type Subscription {
    alertCreated: AlertCreatedPayload!
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
