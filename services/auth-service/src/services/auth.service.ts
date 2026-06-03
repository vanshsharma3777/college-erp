import * as repo from "../repositories/auth.repositories";
import { generateToken } from "../utils/jwt";
import { comparePassword, hashPassword } from "../utils/password";

export async function register(data: any) {
  const existingUser = await repo.findByEmail(data.email);

  if (existingUser) {
    throw new Error("User exists");
  }

  const passwordHash = await hashPassword(data.password);
  console.log("data" , data)
  console.log("has passworda" , passwordHash)

  const user = await repo.createUser({
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    passwordHash,
    role: "STUDENT",
    version: 1,
    departmentId:data.departmentId
  });

  return user;
}

export async function login(
  email: string,
  password: string
) {
  const user = await repo.findByEmail(email);
  if (!user) {
    throw new Error("Invalid credentials");
  }

  const isPasswordValid = await comparePassword(
    password,
    user.passwordHash!
  );

  if (!isPasswordValid) {
     console.log("hello6")
    throw new Error("Invalid credentials");
  }

  const token = generateToken(user);

  return {
    user,
    token,
  };
}

