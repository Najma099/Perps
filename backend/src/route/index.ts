import { Router } from "express";
import  authRouter  from "./auth.route.js";
import  exchangeRouter  from "./perbs.route.js";

export const appRouter = Router();

appRouter.use(authRouter);
appRouter.use("/perps", exchangeRouter);