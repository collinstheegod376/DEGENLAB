import { eq } from "drizzle-orm";
import { botSessions, type Database } from "@degenlab/database";
import type { SessionState } from "@degenlab/shared-types";

export async function loadSession(
  db: Database,
  telegramUserId: bigint,
): Promise<SessionState> {
  const [row] = await db
    .select()
    .from(botSessions)
    .where(eq(botSessions.telegramUserId, telegramUserId))
    .limit(1);
  return (row?.stateJson as SessionState) ?? {};
}

export async function saveSession(
  db: Database,
  telegramUserId: bigint,
  state: SessionState,
): Promise<void> {
  await db
    .insert(botSessions)
    .values({
      telegramUserId,
      stateJson: state as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: botSessions.telegramUserId,
      set: {
        stateJson: state as Record<string, unknown>,
        updatedAt: new Date(),
      },
    });
}
