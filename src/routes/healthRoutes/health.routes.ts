import { Router } from "express";
import { getHealthHandler } from "../../handlers/health/getHealthHandler";

const router = Router();

router.get("/", getHealthHandler);

export default router;
