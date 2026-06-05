import { Router, Request, Response } from "express";

const router = Router();

// Hardcoded pickup points for Uganda — no DB model needed yet
const PICKUP_POINTS = [
  {
    id: "pp-1",
    name: "Kampala Central Post Office",
    address: "Plot 35, Kampala Road",
    city: "Kampala",
    county: "Kampala",
    hours: "Mon-Sat 8:00 AM - 6:00 PM",
    phone: "+256 700 100 001",
    type: "Post Office",
    isActive: true,
  },
  {
    id: "pp-2",
    name: "Garden City Mall Pickup",
    address: "Yusuf Lule Road, Garden City Mall",
    city: "Kampala",
    county: "Kampala",
    hours: "Mon-Sun 9:00 AM - 9:00 PM",
    phone: "+256 700 100 002",
    type: "Mall Locker",
    isActive: true,
  },
  {
    id: "pp-3",
    name: "Acacia Mall Collection Point",
    address: "Acacia Avenue, Kololo",
    city: "Kampala",
    county: "Kampala",
    hours: "Mon-Sun 8:00 AM - 10:00 PM",
    phone: "+256 700 100 003",
    type: "Mall Locker",
    isActive: true,
  },
  {
    id: "pp-4",
    name: "Jinja Road Pickup Center",
    address: "Plot 12, Jinja Road",
    city: "Kampala",
    county: "Kampala",
    hours: "Mon-Fri 9:00 AM - 5:00 PM",
    phone: "+256 700 100 004",
    type: "Pickup Center",
    isActive: true,
  },
  {
    id: "pp-5",
    name: "Entebbe Town Agent",
    address: "Airport Road, near Total Petrol Station",
    city: "Entebbe",
    county: "Wakiso",
    hours: "Mon-Sat 8:00 AM - 7:00 PM",
    phone: "+256 700 100 005",
    type: "Agent",
    isActive: true,
  },
  {
    id: "pp-6",
    name: "Mukono Pickup Point",
    address: "Main Street, opposite Mukono Town Council",
    city: "Mukono",
    county: "Mukono",
    hours: "Mon-Sat 8:00 AM - 6:00 PM",
    phone: "+256 700 100 006",
    type: "Agent",
    isActive: true,
  },
  {
    id: "pp-7",
    name: "Jinja Central Agent",
    address: "Bell Avenue, Jinja Town",
    city: "Jinja",
    county: "Jinja",
    hours: "Mon-Sat 9:00 AM - 5:00 PM",
    phone: "+256 700 100 007",
    type: "Agent",
    isActive: true,
  },
  {
    id: "pp-8",
    name: "Mbarara Town Pickup",
    address: "High Street, near Mbarara University",
    city: "Mbarara",
    county: "Mbarara",
    hours: "Mon-Sat 9:00 AM - 6:00 PM",
    phone: "+256 700 100 008",
    type: "Agent",
    isActive: true,
  },
];

router.get("/", (_req: Request, res: Response) => {
  const active = PICKUP_POINTS.filter((p) => p.isActive);
  res.json(active);
});

router.get("/:id", (req: Request, res: Response) => {
  const point = PICKUP_POINTS.find((p) => p.id === req.params.id);
  if (!point) return res.status(404).json({ error: "Pickup point not found" });
  res.json(point);
});

export default router;
