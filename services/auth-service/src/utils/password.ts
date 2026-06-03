import bcrypt from "bcrypt";

export const hashPassword =(password: string) => bcrypt.hash(password, 12);

export const comparePassword =(password: string, hash: string) =>
    bcrypt.compare(
        password,
        hash
    );
    console.log("hello compare")