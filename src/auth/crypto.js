import { USERS_URL } from "../config.js";

export async function sha256Hex(str) {
  const enc = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
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

export async function tryLogin(username, password) {
  username = (username || "").trim();
  password = (password || "").replace(/^\s+|\s+$/g, "");
  if (!username || !password) return {
    ok: false,
    msg: "Preencha usuário e senha."
  };
  const users = await fetchUsers();
  if (!users) return {
    ok: false,
    msg: "Não foi possível verificar o login (sem conexão e sem dados salvos ainda)."
  };
  const u = users.find(x => x.username.toLowerCase() === username.toLowerCase());
  if (!u) return {
    ok: false,
    msg: "Usuário ou senha inválidos."
  };
  let hash;
  try {
    hash = await sha256Hex((u.salt || "") + password);
  } catch (e) {
    return {
      ok: false,
      msg: "Não foi possível verificar a senha neste navegador."
    };
  }
  if (hash !== u.hash) return {
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
