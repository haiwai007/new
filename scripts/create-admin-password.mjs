import { pathToFileURL } from "node:url";
import { pbkdf2Sync, randomBytes } from "node:crypto";
export function passwordHash(password, { initial = false } = {}) {
  if (
    typeof password !== "string" ||
    password.length < (initial ? 6 : 12) ||
    password.length > 256
  )
    throw new Error(
      initial ? "临时密码需为 6～256 个字符" : "管理员密码需为 12～256 个字符",
    );
  const salt = randomBytes(16);
  return `pbkdf2$100000$${salt.toString("hex")}$${pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("hex")}`;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const initial = process.argv.includes("--initial");
  let password = "";
  if (process.stdin.isTTY) {
    process.stderr.write(
      "请输入管理员密码（默认至少 12 个字符，--initial 临时密码至少 6 位，不回显）：",
    );
    process.stdin.setRawMode(true);
    process.stdin.resume();
    password = await new Promise((resolve, reject) => {
      const onData = (chunk) => {
        for (const ch of chunk.toString()) {
          if (ch === "\u0003") {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            reject(new Error("已取消"));
            return;
          }
          if (ch === "\r" || ch === "\n") {
            process.stdin.off("data", onData);
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stderr.write("\n");
            resolve(password);
            return;
          }
          if (ch === "\u007f" || ch === "\b") password = password.slice(0, -1);
          else password += ch;
        }
      };
      process.stdin.on("data", onData);
    });
  } else {
    for await (const chunk of process.stdin) password += chunk.toString();
    password = password.replace(/\r?\n$/, "");
  }
  try {
    process.stdout.write(passwordHash(password, { initial }) + "\n");
  } catch (e) {
    process.stderr.write(e.message + "\n");
    process.exitCode = 1;
  }
}
