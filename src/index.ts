import dotenv from "dotenv";

dotenv.config();

import app from "./app";
import { connectDatabase } from "./config/database";
import { env } from "./config/env";
import "./models";

const start = async () => {
  try {
    await connectDatabase();

    app.listen(env.port, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${env.port}`);
    });
  } catch (error) {
    console.error("No se pudo iniciar el servidor:", error);
    process.exit(1);
  }
};

start();
