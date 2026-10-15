import { USERS_URL } from "../config.js";
import { derive, fromB64, sameBytes } from "./pin.js";

/* Formatos de senha em users.json:
   - novo: { alg: "PBKDF2-SHA256", iter, salt (base64, 16 bytes), hash (base64, 32 bytes) },
     o mesmo padrão do PIN (src/auth/pin.js). Gerado por tools/gerar-hash.html.
   - antigo (transição): { salt, hash } com SHA-256(salt + senha) em hexadecimal.
     Continua aceito até o usuário ser regenerado com a ferramenta nova. */
export const PASSWORD_ALG = "PBKDF2-SHA256";
export const PASSWORD_MIN_ITERATIONS = 100000;

export async function sha256Hex(str) {
  const enc = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function fetchUsers() {
  try {
    const res = await fetch(USERS_URL, {
      cache: "no-cache"
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data && data.users) ? data.users : null;
  } catch (e) {
    return null;
  }
}

/* Confere a senha contra o registro do usuário, nos dois formatos. Lança erro se
   o navegador não tiver crypto.subtle; registro malformado simplesmente não confere. */
export async function verifyPassword(u, password) {
  if (u.alg === PASSWORD_ALG) {
    const iter = Number(u.iter);
    if (!Number.isInteger(iter) || iter < PASSWORD_MIN_ITERATIONS || !u.salt || !u.hash) return false;
    let salt, want;
    try {
      salt = fromB64(u.salt);
      want = fromB64(u.hash);
    } catch (e) {
      return false;
    }
    return sameBytes(await derive(password, salt, iter), want);
  }
  return (await sha256Hex((u.salt || "") + password)) === u.hash;
}

export async function tryLogin(username, password) {
  username = (username || "").trim();
  password = (password || "").replace(/^\s+|\s+$/g, "");
  if (!username || !password)
    return {
      ok: false,
      msg: "Preencha usuário e senha."
    };
  const users = await fetchUsers();
  if (!users)
    return {
      ok: false,
      msg: "Não foi possível verificar o login (sem conexão e sem dados salvos ainda)."
    };
  const u = users.find((x) => x.username.toLowerCase() === username.toLowerCase());
  if (!u)
    return {
      ok: false,
      msg: "Usuário ou senha inválidos."
    };
  let good;
  try {
    good = await verifyPassword(u, password);
  } catch (e) {
    return {
      ok: false,
      msg: "Não foi possível verificar a senha neste navegador."
    };
  }
  if (!good)
    return {
      ok: false,
      msg: "Usuário ou senha inválidos."
    };
  return {
    ok: true,
    user: {
      username: u.username,
      name: u.name || u.username
    }
  };
}
