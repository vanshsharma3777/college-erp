import { Router } from "express";

import * as authController from "../controllers/auth.controllers";

const router = Router();

router.post(
  "/login",
  authController.login
);
router.post(
  "/register",
  authController.register
);

router.get("/test", (req, res) => {
  res.send("Auth Working");
});

export default router;