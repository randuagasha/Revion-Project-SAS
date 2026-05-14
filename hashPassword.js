import bcrypt from "bcryptjs";

const password = "superadmin123";

const hashed = await bcrypt.hash(password, 10);

console.log(hashed);