import { hashPassword } from "../helpers/password";
import { User, Table, Category, Dish } from "../models";
import { sequelize } from "../config/database";
import "../models";
import { CARTA_CATEGORIES, CARTA_DISHES } from "./cartaTimboSet2026";

const shouldReset =
  process.argv.includes("--reset") || process.env.RESET_DB === "true";

const run = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ force: shouldReset });
    if (shouldReset) {
      console.log("Base de datos vaciada y tablas recreadas.");
    }

    const users = [
      {
        name: "Administrador",
        username: "admin",
        email: "admin@timbo.com",
        password: "admin123",
        role: "admin" as const,
      },
      {
        name: "Mesero Demo",
        username: "mesero",
        email: "mesero@timbo.com",
        password: "mesero123",
        role: "mesero" as const,
      },
      {
        name: "Cocinero Demo",
        username: "cocinero",
        email: "cocinero@timbo.com",
        password: "cocinero123",
        role: "cocinero" as const,
      },
    ];

    for (const item of users) {
      const existing = await User.findOne({ where: { email: item.email } });
      if (!existing) {
        await User.create({
          name: item.name,
          username: item.username,
          email: item.email,
          password_hash: await hashPassword(item.password),
          role: item.role,
          email_verified: true,
          is_active: true,
        });
        console.log(`Usuario creado: ${item.email} / ${item.password}`);
      } else {
        if (!existing.username) {
          existing.username = item.username;
          await existing.save();
        }
        console.log(`Usuario ya existe: ${item.email}`);
      }
    }

    const tableCount = await Table.count();
    if (tableCount === 0) {
      await Table.bulkCreate(
        Array.from({ length: 30 }, (_, i) => ({
          number: i + 1,
          capacity: 4,
          is_active: true,
        }))
      );
      console.log("30 mesas creadas.");
    }

    const categoryByName = new Map<string, Category>();
    for (const [index, name] of CARTA_CATEGORIES.entries()) {
      const [category] = await Category.findOrCreate({
        where: { name },
        defaults: {
          name,
          is_active: true,
          sort_order: index + 1,
        },
      });
      if (!category.is_active) {
        category.is_active = true;
        await category.save();
      }
      category.sort_order = index + 1;
      await category.save();
      categoryByName.set(name, category);
    }
    console.log(`${categoryByName.size} categorías de la carta.`);

    let createdDishes = 0;
    let updatedDishes = 0;
    for (const item of CARTA_DISHES) {
      const category = categoryByName.get(item.category);
      if (!category) {
        throw new Error(`Falta la categoría "${item.category}"`);
      }
      const existing = await Dish.findOne({
        where: { name: item.name, presentation: item.presentation },
      });
      if (!existing) {
        await Dish.create({
          category_id: category.id,
          name: item.name,
          presentation: item.presentation,
          price: item.price,
          description: item.description,
          is_active: true,
          category_disabled: false,
        });
        createdDishes += 1;
      } else {
        existing.category_id = category.id;
        existing.price = item.price;
        existing.description = item.description;
        existing.category_disabled = false;
        if (!existing.is_active && category.is_active) {
          existing.is_active = true;
        }
        await existing.save();
        updatedDishes += 1;
      }
    }
    console.log(
      `Carta: ${createdDishes} platos nuevos, ${updatedDishes} actualizados.`
    );

    console.log("Seed completado.");
    process.exit(0);
  } catch (error) {
    console.error("Error en seed:", error);
    process.exit(1);
  }
};

run();
