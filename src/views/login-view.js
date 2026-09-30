import { doLogin, readRememberedUser } from "../auth/session.js";
import { ICONS } from "../data/icons.js";
import { store } from "../store.js";
import { showToast } from "../ui/toast.js";
import { escapeHtml } from "../utils/dom.js";

/* ============================================================
   LOGIN
   ============================================================ */
export function renderLogin() {
  const app = document.getElementById("app");
  const bar = document.getElementById("tabBar");
  if (bar) bar.innerHTML = "";
  if (!app) return;
  app.innerHTML = `<div class="login-wrap">
    <div class="login-logo"><img src="icons/logo.png" alt="Meus Treinos" width="104" height="104" draggable="false"></div>
    <h1 class="login-title">Meus <span class="accent">Treinos</span></h1>
    <p class="login-sub">Sua evolução começa aqui!</p>

    <form class="login-form" id="loginForm" method="post" action="#" autocomplete="on">
      <label class="login-input-wrap">
        <span class="li-icon">${ICONS.user}</span>
        <input type="text" id="loginUser" name="username" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Usuário">
      </label>

      <label class="login-input-wrap">
        <span class="li-icon">${ICONS.lock}</span>
        <input type="password" id="loginPass" name="password" autocomplete="current-password" placeholder="Senha">
        <button type="button" class="pw-toggle" id="loginPwToggle" aria-label="mostrar senha">${ICONS.eye}</button>
      </label>

      <label class="login-keep-row">
        <span class="switch lg">
          <input type="checkbox" id="loginKeep" checked>
          <span class="slider"></span>
        </span>
        <span>Manter conectado</span>
      </label>

      ${store.authError ? `<div class="login-error">${escapeHtml(store.authError)}</div>` : ""}

      <button type="submit" class="cta-btn" id="loginSubmit" ${store.authBusy ? "disabled" : ""}>${store.authBusy ? "Entrando…" : "Entrar"}</button>
    </form>

    <div class="login-footer">
      Ainda não tem uma conta?<br>
      <a href="#" id="loginHelpLink">Fale com o seu treinador</a>
    </div>
  </div>`;
  const userInput = document.getElementById("loginUser");
  const passInput = document.getElementById("loginPass");
  const remembered = readRememberedUser();
  if (remembered && !userInput.value) userInput.value = remembered;
  // O <form> real é o que faz o navegador/iCloud Keychain oferecer salvar e
  // preencher usuário e senha. O submit (botão Entrar ou Enter) cai aqui.
  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (store.authBusy) return;
    await doLogin(userInput.value, passInput.value, document.getElementById("loginKeep").checked);
  });
  document.getElementById("loginPwToggle").addEventListener("click", () => {
    const show = passInput.type === "password";
    passInput.type = show ? "text" : "password";
    document.getElementById("loginPwToggle").innerHTML = show ? ICONS.eyeOff : ICONS.eye;
  });
  const helpLink = document.getElementById("loginHelpLink");
  if (helpLink) helpLink.addEventListener("click", e => {
    e.preventDefault();
    showToast("Fale com seu treinador para criar seu acesso");
  });
  if (!store.authBusy) (userInput.value ? passInput : userInput).focus();
}

/* ============================================================
   BOOT
   ============================================================ */
