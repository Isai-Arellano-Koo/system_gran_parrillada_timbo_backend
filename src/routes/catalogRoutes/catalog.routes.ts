import { Router } from "express";
import {
  listIngredientsHandler,
  createIngredientHandler,
  updateIngredientHandler,
  listDishesHandler,
  createDishHandler,
  updateDishHandler,
  setRecipeHandler,
} from "../../handlers/catalog/catalog.handlers";
import { authMiddleware } from "../../middlewares/authMiddleware";
import { requireRoles } from "../../middlewares/roleMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/ingredients", listIngredientsHandler);
router.post("/ingredients", requireRoles("admin"), createIngredientHandler);
router.patch(
  "/ingredients/:id",
  requireRoles("admin"),
  updateIngredientHandler
);

router.get("/dishes", listDishesHandler);
router.post("/dishes", requireRoles("admin"), createDishHandler);
router.patch("/dishes/:id", requireRoles("admin"), updateDishHandler);
router.put(
  "/dishes/:dishId/recipe",
  requireRoles("admin"),
  setRecipeHandler
);

export default router;
