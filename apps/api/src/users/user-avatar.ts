import { eq } from 'drizzle-orm';
import type { Database } from '../database/database.module.js';
import { users } from '../database/schema.js';

export type StoredAvatar = { storageName: string; mimeType: string };

export type PreviousAvatar = { storageName: string | null };

// The row lock serializes concurrent replacements, so each one reads the name
// the other wrote and the caller deletes every replaced file. Resolves
// undefined when the user does not exist.
export async function replaceUserAvatar(
  database: Database,
  userId: string,
  avatar: StoredAvatar | null,
): Promise<PreviousAvatar | undefined> {
  return database.transaction(async (transaction) => {
    const [user] = await transaction
      .select({ storageName: users.avatarStorageName })
      .from(users)
      .where(eq(users.id, userId))
      .for('update');
    if (!user) {
      return undefined;
    }
    await transaction
      .update(users)
      .set({
        avatarStorageName: avatar?.storageName ?? null,
        avatarMimeType: avatar?.mimeType ?? null,
      })
      .where(eq(users.id, userId));
    return user;
  });
}
