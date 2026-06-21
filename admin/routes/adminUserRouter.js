import express from "express";
import { getAllUsers, getUserById } from "../controllers/adminUserController.js";
import { adminMiddleware } from "../../middleware/adminMiddleware.js";

const router = express.Router();
router.use(adminMiddleware);
router.get("/", getAllUsers);
router.get("/:id", getUserById);
export default router;
