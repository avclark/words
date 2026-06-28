import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import friendsRouter from "./friends";
import gamesRouter from "./games";
import chatRouter from "./chat";
import statsRouter from "./stats";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(friendsRouter);
router.use(gamesRouter);
router.use(chatRouter);
router.use(statsRouter);
router.use(notificationsRouter);

export default router;
