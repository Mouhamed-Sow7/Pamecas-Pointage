export function showModal({ title, content, onConfirm, onCancel, confirmText = 'Confirmer', cancelText = 'Annuler' }) {
  let overlay = document.getElementById('gds-modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'gds-modal-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(15, 23, 42, 0.5)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '40';
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="card" style="max-width: 480px; width: 90%;">
      <h2 style="margin-bottom: 12px; font-size: 18px;">${title}</h2>
      <div style="margin-bottom: 16px;">${content}</div>
      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button id="gds-modal-cancel" class="btn-danger" type="button">${cancelText}</button>
        <button id="gds-modal-confirm" class="btn-primary" type="button">${confirmText}</button>
      </div>
    </div>
  `;

  function close() {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }

  overlay.querySelector('#gds-modal-cancel').addEventListener('click', () => {
    if (onCancel) onCancel();
    close();
  });

  overlay.querySelector('#gds-modal-confirm').addEventListener('click', () => {
    if (onConfirm) onConfirm(close);
  });
}

