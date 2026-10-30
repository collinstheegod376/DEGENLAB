import { eq } from "drizzle-orm";
import { practiceAccounts, users, type Database } from "@degenlab/database";

export async function loadOrCreateUser(
  db: Database,
  telegramUserId: bigint,
  username: string | undefined,
  displayName: string,
  startingBalance: string,
) {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.telegramUserId, telegramUserId))
    .limit(1);

  if (existing) {
    const [account] = await db
      .select()
      .from(practiceAccounts)
      .where(eq(practiceAccounts.userId, existing.id))
      .limit(1);
    if (!account) {
      const [createdAccount] = await db
        .insert(practiceAccounts)
        .values({
          userId: existing.id,
          startingVirtualBalance: startingBalance,
          availableVirtualBalance: startingBalance,
        })
        .returning();
      return { user: existing, account: createdAccount! };
    }
    if (username && username !== existing.telegramUsername) {
      await db
        .update(users)
        .set({ telegramUsername: username, updatedAt: new Date() })
        .where(eq(users.id, existing.id));
    }
    return { user: existing, account };
  }

  const [user] = await db
    .insert(users)
    .values({
      telegramUserId,
      telegramUsername: username ?? null,
      displayName,
      practiceModeEnabled: true,
      leaderboardOptIn: false,
    })
    .returning();
  if (!user) throw new Error("failed to create user");
  const [account] = await db
    .insert(practiceAccounts)
    .values({
      userId: user.id,
      startingVirtualBalance: startingBalance,
      availableVirtualBalance: startingBalance,
    })
    .returning();
  if (!account) throw new Error("failed to create practice account");
  return { user, account };
}
