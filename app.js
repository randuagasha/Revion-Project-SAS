import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoute from "./routes/authRoute.js";
import bookingRoute from "./routes/bookingRoute.js";
import userRoute from "./routes/userRoute.js";
import vehicleRoute from "./routes/vehicleRoute.js";
import serviceRoute from "./routes/serviceRoute.js";
import adminUserRoute from "./routes/adminUserRoute.js";
import ticketRoute from "./routes/ticketRoute.js";
import ticketMessageRoute from "./routes/ticketMessageRoute.js";
import dashboardRoute from "./routes/dashboardRoute.js";
import bookingProgressRoute from "./routes/bookingProgressRoute.js";

import connection from "./database.js";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json());
app.use("/uploads", express.static("uploads"));

app.use("/api/auth", authRoute);
app.use("/api/user", userRoute);
app.use("/api/bookings", bookingRoute);
app.use("/api/vehicles", vehicleRoute);
app.use("/api/services", serviceRoute);
app.use("/api/booking-progress", bookingProgressRoute);
app.use("/api/admin/users", adminUserRoute);
app.use("/api/tickets", ticketRoute);
app.use("/api/ticket-messages", ticketMessageRoute);
app.use("/api/dashboard", dashboardRoute);

app.get("/", async (req, res) => {
  try {
    const [rows] = await connection.execute("SELECT 1");

    return res.json({
      success: true,
      message: "Database connected",
      rows,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.use((err, req, res, next) => {
  console.error("GLOBAL_ERROR:", err);

  return res.status(500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
