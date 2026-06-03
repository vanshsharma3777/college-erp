import type { Request, Response } from "express";
import * as authService from "../services/auth.service";

export async function login(
  req: Request,
  res: Response
) {
  const { email, password } = req.body;

  const { token } = await authService.login(
    email,
    password
  );

  res.cookie(
    "accessToken",
    token,
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    }
  );

  return res.status(200).json({
    success: true,
    token
  });
}

export async function register(
  req: Request,
  res: Response
) {

  const user =
    await authService.register(
      req.body
    );

  return res.status(201).json({
    success: true,
    user,
  });
}