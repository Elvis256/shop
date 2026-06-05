import prisma from "./prisma";
import { logger } from "./logger";

interface LogActivityParams {
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  description: string;
  metadata?: Record<string, any>;
}

export async function logActivity({
  userId,
  action,
  entityType,
  entityId,
  description,
  metadata,
}: LogActivityParams): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId: entityId || null,
        description,
        metadata: metadata || undefined,
      },
    });
  } catch (error) {
    logger.error("Activity log error", { error });
  }
}
