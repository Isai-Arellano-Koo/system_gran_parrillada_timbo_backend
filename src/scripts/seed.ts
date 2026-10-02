import { hashPassword } from "../helpers/password";
import { User, Table } from "../models";
import { sequelize } from "../config/database";
import "../models";

const run = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });

    const users = [
      {
        name: "Administrador",
        email: "admin@timbo.com",
        password: "admin123",
        role: "admin" as const,
      },
      {
        name: "Mesero Demo",
        email: "mesero@timbo.com",
        password: "mesero123",
        role: "mesero" as const,
      },
      {
        name: "Cocinero Demo",
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
          email: item.email,
          password_hash: await hashPassword(item.password),
          role: item.role,
        });
        console.log(`Usuario creado: ${item.email} / ${item.password}`);
      } else {
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

    console.log("Seed completado.");
    process.exit(0);
  } catch (error) {
    console.error("Error en seed:", error);
    process.exit(1);
  }
};

run();
