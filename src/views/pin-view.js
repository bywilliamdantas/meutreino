import { tryLogin } from "../auth/crypto.js";
import { hasPin, isValidPin, isWeakPin, pinSupported, removePin, setPin } from "../auth/pin.js";
import { ICONS } from "../data/icons.js";
import { store } from "../store.js";
import { showToast } from "../ui/toast.js";
import { closeOverlay, openConfirm, renderOverlay } from "./overlays/overlay-manager.js";
import { render } from "./render.js";

export function openPinSheet() {
  store.overlay = { type: "pin" };
  renderOverlay();
}

/* Criar/alterar PIN: pede a senha atual (prova de que quem está criando o PIN
   conhece a senha — e funciona só com conexão para conferir em users.json). */
export function renderPinOverlay(root) {
  const user = store.currentUser;
  const has = hasPin(user.username);
  root.innerHTML = `<div class="sheet-backdrop" id="sheetBackdrop"></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <div class="sheet-date" id="sheetTitle">${has ? "Alterar PIN" : "Criar PIN de acesso"}</div>
      <button class="icon-btn" id="sheetClose" aria-label="fechar">${ICONS.close}</button>
    </div>
    <p class="pin-note">O PIN de 4 dígitos vale só neste aparelho e deixa o login mais rápido. Sua senha continua funcionando e é a forma de recuperar o acesso se você esquecer o PIN.</p>
    <label class="pin-field">Sua senha atual
      <input type="password" id="pinCurrentPass" autocomplete="off" autocapitalize="off">
    </label>
    <label class="pin-field">Novo PIN (4 dígitos)
      <input type="password" class="pin-digits" id="pinNew" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off">
    </label>
    <label class="pin-field">Repita o PIN
      <input type="password" class="pin-digits" id="pinNew2" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off">
    </label>
    <div class="pin-error" id="pinError" role="alert"></div>
    <div class="sheet-actions">
      <button class="footer-btn primary" id="pinSave">${has ? "Salvar novo PIN" : "Ativar PIN"}</button>
      ${has ? `<button class="footer-btn danger" id="pinRemove">Remover PIN</button>` : ""}
    </div>
  </div>`;
  const $ = (id) => document.getElementById(id);
  $("sheetBackdrop").addEventListener("click", closeOverlay);
  $("sheetClose").addEventListener("click", closeOverlay);
  ["pinNew", "pinNew2"].forEach((id) =>
    $(id).addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
    })
  );
  const err = (msg) => {
    $("pinError").textContent = msg;
    $("pinSave").disabled = false;
  };
  $("pinSave").addEventListener("click", async () => {
    const pass = $("pinCurrentPass").value;
    const pin = $("pinNew").value;
    if (!pinSupported()) return err("Este navegador não suporta PIN seguro.");
    if (!pass) return err("Digite sua senha atual.");
    if (!isValidPin(pin)) return err("O PIN precisa ter exatamente 4 números.");
    if (pin !== $("pinNew2").value) return err("Os dois PINs não são iguais.");
    if (isWeakPin(pin)) return err("PIN fácil demais (como 0000 ou 1234). Escolha outro.");
    $("pinSave").disabled = true;
    $("pinError").textContent = "";
    const r = await tryLogin(user.username, pass);
    if (!r.ok) return err(/inválid/.test(r.msg) ? "Senha incorreta." : r.msg);
    try {
      await setPin(user, pin);
    } catch (e) {
      return err("Não foi possível salvar o PIN neste aparelho.");
    }
    store.overlay = null;
    renderOverlay();
    render();
    showToast(has ? "PIN alterado" : "PIN ativado");
  });
  const rm = $("pinRemove");
  if (rm)
    rm.addEventListener("click", () => {
      openConfirm(
        "Remover o PIN? Você volta a entrar só com a senha.",
        () => {
          removePin(user.username);
          render();
          showToast("PIN removido");
        },
        { yesLabel: "Remover", noLabel: "Cancelar", yesStyle: "danger" }
      );
    });
}
