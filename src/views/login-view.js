import { doLogin, doLoginPin, readRememberedUser } from "../auth/session.js";
import { hasPin } from "../auth/pin.js";
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

      <label class="login-input-wrap hidden" id="loginPinWrap">
        <span class="li-icon">${ICONS.lock}</span>
        <input type="password" id="loginPin" name="pin" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="PIN de 4 dígitos" aria-label="PIN de 4 dígitos">
      </label>
      <a href="#" class="login-mode-link hidden" id="loginModeLink"></a>

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
    <div class="login-copyright">© 2026 William Dantas · Todos os direitos reservados</div>
  </div>`;
  const userInput = document.getElementById("loginUser");
  const passInput = document.getElementById("loginPass");
  const pinInput = document.getElementById("loginPin");
  const remembered = store.loginUser || readRememberedUser();
  if (remembered && !userInput.value) userInput.value = remembered;
  // PIN só aparece para quem tem PIN neste aparelho; a senha sempre está a um toque.
  const pinMode = () => hasPin(userInput.value.trim()) && store.loginMode !== "password";
  const applyMode = () => {
    const withPin = pinMode();
    const canSwitch = hasPin(userInput.value.trim());
    document.getElementById("loginPinWrap").classList.toggle("hidden", !withPin);
    passInput.closest("label").classList.toggle("hidden", withPin);
    const link = document.getElementById("loginModeLink");
    link.classList.toggle("hidden", !canSwitch);
    link.textContent = withPin ? "Entrar com senha" : "Entrar com PIN";
  };
  applyMode();
  userInput.addEventListener("input", () => {
    store.loginMode = null;
    applyMode();
  });
  document.getElementById("loginModeLink").addEventListener("click", e => {
    e.preventDefault();
    store.loginMode = pinMode() ? "password" : "pin";
    applyMode();
    (pinMode() ? pinInput : passInput).focus();
  });
  const submitPin = () => {
    if (store.authBusy) return;
    doLoginPin(userInput.value, pinInput.value, document.getElementById("loginKeep").checked);
  };
  pinInput.addEventListener("input", () => {
    pinInput.value = pinInput.value.replace(/\D/g, "").slice(0, 4);
    if (pinInput.value.length === 4) submitPin();
  });
  // O <form> real é o que faz o navegador/iCloud Keychain oferecer salvar e
  // preencher usuário e senha. O submit (botão Entrar ou Enter) cai aqui.
  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (store.authBusy) return;
    if (pinMode()) return submitPin();
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
  if (!store.authBusy) (userInput.value ? (pinMode() ? pinInput : passInput) : userInput).focus();
}

/* ============================================================
   BOOT
   ============================================================ */
