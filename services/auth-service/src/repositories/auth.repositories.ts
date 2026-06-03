import { db } from "@repo/db";
import { eq } from "drizzle-orm";
import { users } from "../../../../packages/db/src/schema";

export async function findByEmail(
  email: string
) {
  try {
    return await db.query.users.findFirst({
      where: (user, { eq }) =>
        eq(user.email, email),
    });
  } catch (error) {
    console.error(error);
    throw error;
  }
}
export async function findById(id: string) {
  return await db.query.users.findFirst({
    where: (user, { eq }) => eq(user.id, id),
  });
}
    
export async function createUser(
  data: typeof users.$inferInsert
) {
  const result = await db
    .insert(users)
    .values(data)
    .returning();

  return result[0];
}

export async function incrementVersion(userId: string) {
  const user = await findById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  await db
    .update(users)
    .set({
      version: user.version! + 1,
    })
    .where(eq(users.id, (userId)));
}
