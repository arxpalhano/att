/**
 * Hash/verificação da senha de uma base da KB. Só para uso no servidor (node:crypto).
 * Formato guardado: `scrypt$<salt hex>$<hash hex>`.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

export function hashKbPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password.normalize("NFKC"), salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyKbPassword(password: string, stored: string | undefined): boolean {
  if (!stored) return true;
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const test = scryptSync(password.normalize("NFKC"), salt, 32);
  const ref = Buffer.from(hash, "hex");
  return test.length === ref.length && timingSafeEqual(test, ref);
}
