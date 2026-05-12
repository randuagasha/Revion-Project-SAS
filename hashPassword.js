import bcrypt from "bcryptjs";

const password = "admin12345";

const hashed = await bcrypt.hash(password, 10);

console.log(hashed);