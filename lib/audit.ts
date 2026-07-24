import type { Database } from "../db";
import { auditEvents } from "../db/schema";

type AuditActor = {
  id: number;
  username: string;
};

export async function recordAuditEvent(
  db: Database,
  event: {
    actor?: AuditActor | null;
    shopId?: number | null;
    action: string;
    targetType: string;
    targetId?: string | number | null;
    details?: Record<string, unknown>;
  },
) {
  await db.insert(auditEvents).values({
    actorUserId: event.actor?.id ?? null,
    actorUsername: event.actor?.username ?? null,
    shopId: event.shopId ?? null,
    action: event.action,
    targetType: event.targetType,
    targetId:
      event.targetId === undefined || event.targetId === null
        ? null
        : String(event.targetId),
    details: JSON.stringify(event.details ?? {}),
  });
}

