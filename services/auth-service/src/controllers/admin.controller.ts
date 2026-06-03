import type { Request, Response } from "express";
import * as adminService from "../services/admin.service";export async function logoutUser(
  req: Request,
  res: Response
) {
    
  await adminService.forceLogout(
    req.params.userId as string
  );

  return res.status(200).json({
    success: true,
    message: "User logged out",
  });
}