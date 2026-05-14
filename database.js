import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const connection = await mysql.createConnection({
  host: "localhost",
  user: "root",
  database: "revion_db",
  port: 3307,
});

export default connection;
