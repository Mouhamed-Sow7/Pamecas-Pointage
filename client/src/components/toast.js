let toastContainer = null;

function ensureContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'gds-toast-container';
    toastContainer.style.position = 'fixed';
    toastContainer.style.right = '16px';
    toastContainer.style.bottom = '16px';
    toastContainer.style.display = 'flex';
    toastContainer.style.flexDirection = 'column';
    toastContainer.style.gap = '8px';
    toastContainer.style.zIndex = '50';
    document.body.appendChild(toastContainer);
  }
}

export function showToast(message, type = 'success') {
  ensureContainer();
  const toast = document.createElement('div');
  toast.className = 'card';
  toast.style.minWidth = '220px';
  toast.style.padding = '10px 14px';
  toast.style.display = 'flex';
  toast.style.alignItems = 'center';
  toast.style.gap = '8px';

  if (type === 'error') {
    toast.style.borderLeft = '4px solid #e53935';
  } else if (type === 'warning') {
    toast.style.borderLeft = '4px solid #fb8c00';
  } else {
    toast.style.borderLeft = '4px solid #2e7d32';
  }

  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 3500);
}

