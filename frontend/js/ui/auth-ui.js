import { $, $button, $form, $getInner, $queryOne, $queryOneInput } from "../lib/dom.js";
import { _error } from "../lib/logger.js";
import { haptic } from "../lib/haptics.js";
import { apiLogin, apiSignup } from "../api-caller/apiCaller.js";
import { afterLogin, logout } from "../appBoot.js";


const authForm = $form('authForm');
const authNameField = $('authNameField');
const authNameInput = $queryOneInput('#authForm input[name="authName"]');
const authEmailInput = $queryOneInput('#authForm input[name="authEmail"]');
const authPasswordInput = $queryOneInput('#authForm input[name="authPassword"]');
const authFormTitle = $getInner(authForm, '.form-title-text');
const authModeToggle = $('authModeToggle');

let isSignupMode = false;

// Intercept native form submission (e.g. pressing Enter in a field) so it
// doesn't navigate the browser away with the fields as a GET query string.
authForm.addEventListener('submit', submitAuthForm);
authModeToggle.addEventListener('click', () => setMode(!isSignupMode));

/**
 * Wires the login/signup form and a "Cerrar sesión" footer button. Mirrors
 * initBackupUi()/initNotificationsUi()'s "add a footer button" pattern.
 * @param {HTMLElement} footerContainer
 */
function initAuthUi(footerContainer) {
  $button({
    label: 'Iniciar Sesión',
    appendTo: $queryOne('#authForm .submit'),
    listener: { fn: submitAuthForm },
  });
  setMode(false);

  $button({
    class: 'logout-btn',
    label: 'Cerrar sesión',
    appendTo: footerContainer,
    listener: {
      fn: async () => {
        await logout();
        setMode(false); // always land back on the login form, not wherever the mode was left
      },
    },
  });
}

/**
 * @param {boolean} signup
 */
function setMode(signup) {
  isSignupMode = signup;
  const submitLabel = $getInner($queryOne('#authForm .submit'), '.label');

  if (signup) {
    authNameField.classList.remove('display-none');
    authFormTitle.innerText = 'Crear Cuenta';
    submitLabel.innerText = 'Crear Cuenta';
    authModeToggle.innerText = '¿Ya tenés cuenta? Iniciá sesión';
  } else {
    authNameField.classList.add('display-none');
    authFormTitle.innerText = 'Iniciar Sesión';
    submitLabel.innerText = 'Iniciar Sesión';
    authModeToggle.innerText = '¿No tenés cuenta? Creá una';
  }
}

/**
 * @param {Event} e
 */
async function submitAuthForm(e) {
  e.preventDefault();
  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value;
  if (!email || !password) { return; }

  const result = isSignupMode
    ? await apiSignup(email, password, authNameInput.value.trim())
    : await apiLogin(email, password);

  if (!result.data) { return _error(result.error); }

  haptic();
  authForm.reset();
  await afterLogin();
}


export { initAuthUi };
