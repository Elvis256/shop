import { Router } from "express";
import shareDiscountRoutes from "./shareDiscount";
import groupBuyRoutes from "./groupBuy";
import dailyCheckInRoutes from "./dailyCheckIn";
import priceSlashRoutes from "./priceSlash";
import liveFeedRoutes from "./liveFeed";

const router = Router();

router.use("/", shareDiscountRoutes);
router.use("/", groupBuyRoutes);
router.use("/", dailyCheckInRoutes);
router.use("/", priceSlashRoutes);
router.use("/", liveFeedRoutes);

export default router;
