import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { findById } from "../repositories/auth.repositories";


export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.cookies.accessToken;

    if (!token) {
      return res.status(401).json({
        message: "No token",
      });
    }

    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as {
      userId: string;
      version: number;
    };

    const user = await findById(
      (payload.userId)
    );

    if (!user) {
      return res.status(401).json({
        message: "User not found",
      });
    }

    if (
      user.version !==
      payload.version
    ) {
      res.clearCookie("accessToken");

      return res.status(401).json({
        message: "Session expired",
      });
    }

    req.user = user;

    next();
  } catch {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }
}