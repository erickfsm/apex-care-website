const TOAST_CONTAINER_ID = 'apex-toast-container';
const LOADING_OVERLAY_ID = 'apex-loading-overlay';
const focusReturnMap = new WeakMap();
let loadingRequests = 0;

function ensureToastContainer() {
  let container = document.getElementById(TOAST_CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = TOAST_CONTAINER_ID;
    container.className = 'apex-toast-container';
    container.setAttribute('role', 'region');
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-label', 'Notificações');
    document.body.appendChild(container);
  }
  return container;
}

function ensureLoadingOverlay() {
  let overlay = document.getElementById(LOADING_OVERLAY_ID);
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = LOADING_OVERLAY_ID;
    overlay.className = 'apex-loading-overlay';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.tabIndex = -1;

    const content = document.createElement('div');
    content.className = 'apex-loading-content';

    const spinner = document.createElement('div');
    spinner.className = 'apex-loading-spinner';
    spinner.setAttribute('aria-hidden', 'true');

    const message = document.createElement('p');
    message.className = 'apex-loading-message';
    message.textContent = 'Carregando...';

    content.appendChild(spinner);
    content.appendChild(message);
    overlay.appendChild(content);
    document.body.appendChild(overlay);
  }
  return overlay;
}

function removeToast(toast) {
  if (!toast) return;
  toast.classList.add('is-leaving');
  const previousFocus = focusReturnMap.get(toast);
  setTimeout(() => {
    toast.remove();
    if (previousFocus && typeof previousFocus.focus === 'function') {
      previousFocus.focus({ preventScroll: true });
    }
    focusReturnMap.delete(toast);
  }, 150);
}

function showToast(message, { type = 'info', title = '' } = {}) {
  const container = ensureToastContainer();
  const toast = document.createElement('div');
  toast.className = `apex-toast apex-toast--${type}`;
  toast.tabIndex = -1;

  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  focusReturnMap.set(toast, previousFocus);

  const textWrapper = document.createElement('div');
  textWrapper.className = 'apex-toast-text';

  if (title) {
    const heading = document.createElement('strong');
    heading.className = 'apex-toast-title';
    heading.textContent = title;
    textWrapper.appendChild(heading);
  }

  const text = document.createElement('p');
  text.textContent = message;
  textWrapper.appendChild(text);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'apex-toast-close';
  closeButton.setAttribute('aria-label', 'Fechar notificação');
  closeButton.innerHTML = '&times;';

  closeButton.addEventListener('click', () => removeToast(toast));
  toast.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      removeToast(toast);
    }
  });

  toast.appendChild(textWrapper);
  toast.appendChild(closeButton);
  container.appendChild(toast);

  const ariaRole = type === 'error' ? 'alert' : 'status';
  toast.setAttribute('role', ariaRole);
  toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

  requestAnimationFrame(() => {
    if (type === 'error') {
      closeButton.focus({ preventScroll: true });
    } else {
      toast.focus({ preventScroll: true });
    }
  });

  const duration = type === 'error' ? 7000 : 5000;
  const timeoutId = setTimeout(() => removeToast(toast), duration);

  return () => {
    clearTimeout(timeoutId);
    removeToast(toast);
  };
}

export function showSuccess(message, options = {}) {
  return showToast(message, { ...options, type: 'success', title: options.title ?? 'Tudo certo!' });
}

export function showError(message, options = {}) {
  return showToast(message, { ...options, type: 'error', title: options.title ?? 'Ops, algo deu errado' });
}

export function showLoading(message = 'Carregando...') {
  const overlay = ensureLoadingOverlay();
  const messageElement = overlay.querySelector('.apex-loading-message');
  if (messageElement) {
    messageElement.textContent = message;
  }

  loadingRequests += 1;
  if (loadingRequests === 1) {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    focusReturnMap.set(overlay, previousFocus);
    overlay.classList.add('is-visible');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.focus({ preventScroll: true });
  }

  return () => hideLoading();
}

export function hideLoading() {
  const overlay = document.getElementById(LOADING_OVERLAY_ID);
  if (!overlay) return;

  loadingRequests = Math.max(0, loadingRequests - 1);
  if (loadingRequests === 0) {
    overlay.classList.remove('is-visible');
    overlay.setAttribute('aria-hidden', 'true');

    const previousFocus = focusReturnMap.get(overlay);
    if (previousFocus && typeof previousFocus.focus === 'function') {
      previousFocus.focus({ preventScroll: true });
    }
    focusReturnMap.delete(overlay);
  }
}

export default {
  showSuccess,
  showError,
  showLoading,
  hideLoading,
};
