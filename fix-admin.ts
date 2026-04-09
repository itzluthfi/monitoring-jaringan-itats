import bcrypt from 'bcryptjs';
import { db } from './server/db';
async function run() {
  const hash = await bcrypt.hash('admin123', 10);
  await db.query("UPDATE admin_users SET password = ?", [hash]);
  console.log("Password reset to admin123 for all users");
  process.exit(0);
}
run();
