import { Router } from "express";
import {
  listIngredientsHandler,
  createIngredientHandler,
  updateIngredientHandler,
  listDishesHandler,
  getDishHandler,
  createDishHandler,
  updateDishHandler,
  setRecipeHandler,
  listDishStatusChangesHandler,
  listCategoriesHandler,
  createCategoryHandler,
  updateCategoryHandler,
  removeCategoryHandler,
} from "../../handlers/catalog/catalog.handlers";
import { authMiddleware } from "../../middlewares/authMiddleware";
import { requireRoles } from "../../middlewares/roleMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/categories", listCategoriesHandler);
router.post("/categories", requireRoles("admin"), createCategoryHandler);
router.patch(
  "/categories/:id",
  requireRoles("admin"),
  updateCategoryHandler
);
router.delete(
  "/categories/:id",
  requireRoles("admin"),
  removeCategoryHandler
);

router.get("/ingredients", listIngredientsHandler); // listar sí, crear/editar solo admin
router.post("/ingredients", requireRoles("admin"), createIngredientHandler);
router.patch(
  "/ingredients/:id",
  requireRoles("admin"),
  updateIngredientHandler
);

router.get("/dishes", listDishesHandler);
router.post("/dishes", requireRoles("admin"), createDishHandler);
router.get(
  "/dishes/:id/status-changes",
  requireRoles("admin"),
  listDishStatusChangesHandler
);
router.get("/dishes/:id", getDishHandler);
router.patch("/dishes/:id", requireRoles("admin"), updateDishHandler);
router.put(
  "/dishes/:dishId/recipe",
  requireRoles("admin"),
  setRecipeHandler
);

export default router;
