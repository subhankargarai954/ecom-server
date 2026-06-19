import express from "express";
import { adminLogin, setupAdmin } from "../controllers/adminAuthController.js";

const router = express.Router();
router.post("/login", adminLogin);
router.post("/setup", setupAdmin);
export default router;
