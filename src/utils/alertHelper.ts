import { UserRole, AlertAction } from "@prisma/client";
import { pubsub } from "./pubsub";
import prisma from "../prisma/client";

export interface CreateAlertParams {
  userName: string;
  userRole: UserRole;
  action: AlertAction;
  activity: string;
  userId?: string;
  businessId: string;
}

/**
 * Create an alert/notification and publish it via GraphQL subscription
 */
export const createAlert = async (params: CreateAlertParams) => {
  const { userName, userRole, action, activity, userId,businessId } = params;

  try {
    const alert = await prisma.alert.create({
      data: {
        userName,
        userRole,
        action,
        activity,
        userId,
        businessId,
      },
    });

    // Publish to subscription for real-time updates
    await pubsub.publish("ALERT_CREATED", {
      alertCreated: {
        message: `New alert: ${activity}`,
        alert,
      },
    });

    return alert;
  } catch (error) {
    console.error("Error creating alert:", error);
    throw error;
  }
};

/**
 * Helper functions for common alert types
 */
export const alertHelpers = {
  userCreated: (
    userName: string,
    userRole: UserRole,
    createdUserName: string,
    businessId: string
  ) =>
    createAlert({
      userName,
      userRole,
      action: "CREATE",
      activity: `Created a user "${createdUserName}"`,
      businessId,
    }),

  userUpdated: (
    userName: string,
    userRole: UserRole,
    updatedUserName: string,
    businessId: string
  ) =>
    createAlert({
      userName,
      userRole,
      action: "UPDATE",
      activity: `Updated user "${updatedUserName}"`,
      businessId,
    }),

  userDeleted: (
    userName: string,
    userRole: UserRole,
    deletedUserName: string,
    businessId: string
  ) =>
    createAlert({
      userName,
      userRole,
      action: "DELETE",
      activity: `Deleted staff member "${deletedUserName}"`,
      businessId,
    }),
};
