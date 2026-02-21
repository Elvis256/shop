import { PrismaClient } from "@prisma/client";
import { Request } from "express";

const prisma = new PrismaClient();

export type ActivityAction = 
  | "CREATE" 
  | "UPDATE" 
  | "DELETE" 
  | "LOGIN" 
  | "LOGOUT"
  | "VIEW"
  | "EXPORT"
  | "BULK_UPDATE"
  | "STATUS_CHANGE"
  | "REFUND";

export interface LogActivityParams {
  userId: string;
  action: ActivityAction;
  entityType: string;
  entityId?: string;
  description: string;
  metadata?: Record<string, unknown>;
  req?: Request;
}

export async function logActivity({
  userId,
  action,
  entityType,
  entityId,
  description,
  metadata,
  req,
}: LogActivityParams): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        description,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
        ipAddress: req?.ip || req?.socket.remoteAddress || null,
        userAgent: req?.headers["user-agent"] || null,
      },
    });
  } catch (error) {
    // Don't let logging failures break the main operation
    console.error("Failed to log activity:", error);
  }
}

// Helper to create activity description
export function describeActivity(
  action: ActivityAction,
  entityType: string,
  entityName?: string
): string {
  const entity = entityName ? `"${entityName}"` : entityType.toLowerCase();
  
  switch (action) {
    case "CREATE":
      return `Created ${entity}`;
    case "UPDATE":
      return `Updated ${entity}`;
    case "DELETE":
      return `Deleted ${entity}`;
    case "LOGIN":
      return "Logged in";
    case "LOGOUT":
      return "Logged out";
    case "VIEW":
      return `Viewed ${entity}`;
    case "EXPORT":
      return `Exported ${entityType.toLowerCase()} data`;
    case "BULK_UPDATE":
      return `Bulk updated ${entityType.toLowerCase()}s`;
    case "STATUS_CHANGE":
      return `Changed status of ${entity}`;
    case "REFUND":
      return `Processed refund for ${entity}`;
    default:
      return `${action} ${entity}`;
  }
}
