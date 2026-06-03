import { Router } from "express";


import * as adminController
from "../controllers/admin.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/auth.authorize";

const router = Router();

router.post(
  "/logout-user/:userId",
  authenticate,
   authorize("ADMIN"),
  adminController.logoutUser
);

export default router;