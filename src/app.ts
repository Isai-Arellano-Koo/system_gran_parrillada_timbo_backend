import express from "express";
import cors from "cors";
import morgan from "morgan";
import router from "./routes/index";
import { errorHandler } from "./middlewares/errorHandler";
import { env } from "./config/env";

const app = express();

app.use(morgan("dev"));
app.use(
  cors({
    origin: env.corsOrigin === "*" ? true : env.corsOrigin,
  })
);
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    message: "Gran Parrillada Timbó API funcionando",
    version: "1.0.0",
  });
});

app.use(router);
app.use(errorHandler);

export default app;
