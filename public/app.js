// State
let linksList = [];

// DOM Elements
const shortenForm = document.getElementById('shortenForm');
const originalUrlInput = document.getElementById('originalUrl');
const titleInput = document.getElementById('titleInput');
const customCodeInput = document.getElementById('customCode');
const submitBtn = document.getElementById('submitBtn');
const pasteBtn = document.getElementById('pasteBtn');
const formAlert = document.getElementById('formAlert');

// Result elements
const resultSection = document.getElementById('resultSection');
const resTitle = document.getElementById('resTitle');
const resOriginal = document.getElementById('resOriginal');
const resShortUrl = document.getElementById('resShortUrl');
const resQrImage = document.getElementById('resQrImage');
const copyResBtn = document.getElementById('copyResBtn');
const testResBtn = document.getElementById('testResBtn');
const downloadQrBtn = document.getElementById('downloadQrBtn');

// Stats elements
const statTotalLinks = document.getElementById('statTotalLinks');
const statTotalClicks = document.getElementById('statTotalClicks');
const statUptime = document.getElementById('statUptime');

// Table elements
const linksTableBody = document.getElementById('linksTableBody');
const refreshBtn = document.getElementById('refreshBtn');

// Modal elements
const qrModal = document.getElementById('qrModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalTitle = document.getElementById('modalTitle');
const modalShortUrl = document.getElementById('modalShortUrl');
const modalQrImg = document.getElementById('modalQrImg');
const modalDownloadBtn = document.getElementById('modalDownloadBtn');

// Format relative date
function formatDate(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  const now = new Date();
  const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
  
  if (diffHours < 1) {
    const diffMins = Math.floor((now - date) / (1000 * 60));
    return diffMins <= 1 ? 'Just now' : `${diffMins}m ago`;
  }
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Show alert message
function showAlert(message) {
  formAlert.textContent = message;
  formAlert.style.display = 'block';
  setTimeout(() => {
    formAlert.style.display = 'none';
  }, 5000);
}

// Fetch links from API
async function fetchLinks() {
  try {
    const res = await fetch('/api/links');
    if (!res.ok) throw new Error('Failed to fetch links');
    linksList = await res.json();
    renderLinksTable();
  } catch (err) {
    console.error(err);
    linksTableBody.innerHTML = `<tr><td colspan="6" class="text-center empty-state">Error loading links. Please check server.</td></tr>`;
  }
}

// Fetch server stats
async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    if (res.ok) {
      const data = await res.json();
      statTotalLinks.textContent = data.totalLinks;
      statTotalClicks.textContent = data.totalClicks;
      
      const mins = Math.floor(data.uptimeSeconds / 60);
      statUptime.textContent = mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
    }
  } catch (err) {
    console.error('Stats error:', err);
  }
}

// Render Links Table
function renderLinksTable() {
  if (linksList.length === 0) {
    linksTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center empty-state">
          No short links created yet. Create your first link above!
        </td>
      </tr>
    `;
    return;
  }

  linksTableBody.innerHTML = linksList.map(link => `
    <tr>
      <td>
        <div class="cell-name" title="${escapeHtml(link.title)}">${escapeHtml(link.title)}</div>
        <div class="cell-target" title="${escapeHtml(link.originalUrl)}">${escapeHtml(link.originalUrl)}</div>
      </td>
      <td>
        <span class="code-pill">/${escapeHtml(link.code)}</span>
      </td>
      <td>
        ${link.clicks || 0}
      </td>
      <td style="color: var(--text-muted);">
        ${formatDate(link.createdAt)}
      </td>
      <td>
        <img 
          src="${link.qrCode}" 
          class="qr-thumb-small" 
          alt="QR" 
          title="Click to view QR"
          onclick="openQrModal('${link.id}')"
        >
      </td>
      <td class="text-right">
        <div class="action-group">
          <button class="action-btn" onclick="copyLinkText('${escapeHtml(link.shortUrl)}', this)">Copy</button>
          <a href="${escapeHtml(link.shortUrl)}" target="_blank" class="action-btn" style="text-decoration: none;">Visit</a>
          <button class="action-btn delete" onclick="deleteLink('${link.id}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Escape HTML helper
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Handle Form Submission
shortenForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const originalUrl = originalUrlInput.value.trim();
  const title = titleInput.value.trim();
  const customCode = customCodeInput.value.trim();

  if (!originalUrl) return;

  submitBtn.disabled = true;
  submitBtn.querySelector('.btn-text').style.display = 'none';
  submitBtn.querySelector('.btn-loader').style.display = 'inline';

  try {
    const res = await fetch('/api/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ originalUrl, title, customCode })
    });

    const data = await res.json();

    if (!res.ok) {
      showAlert(data.error || 'Failed to shorten URL.');
      return;
    }

    // Show result card
    resTitle.textContent = data.title;
    resOriginal.textContent = data.originalUrl;
    resShortUrl.value = data.shortUrl;
    resQrImage.src = data.qrCode;
    downloadQrBtn.href = data.qrCode;
    downloadQrBtn.download = `qr-${data.code}.png`;
    testResBtn.href = data.shortUrl;
    resultSection.style.display = 'block';
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Reset inputs
    originalUrlInput.value = '';
    titleInput.value = '';
    customCodeInput.value = '';

    // Refresh table & stats
    fetchLinks();
    fetchStats();
  } catch (err) {
    showAlert('Server connection error. Please try again.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.querySelector('.btn-text').style.display = 'inline';
    submitBtn.querySelector('.btn-loader').style.display = 'none';
  }
});

// Copy button handlers
copyResBtn.addEventListener('click', () => {
  copyLinkText(resShortUrl.value, copyResBtn);
});

window.copyLinkText = function(text, btnElement) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btnElement.innerHTML;
    btnElement.innerHTML = 'Copied!';
    setTimeout(() => {
      btnElement.innerHTML = orig;
    }, 1500);
  }).catch(() => {
    alert('Link: ' + text);
  });
};

// Delete link
window.deleteLink = async function(id) {
  if (!confirm('Are you sure you want to delete this short link?')) return;

  try {
    const res = await fetch(`/api/links/${id}`, { method: 'DELETE' });
    if (res.ok) {
      linksList = linksList.filter(l => l.id !== id);
      renderLinksTable();
      fetchStats();
    } else {
      alert('Could not delete link.');
    }
  } catch (err) {
    alert('Error connecting to server.');
  }
};

// Modal functions
window.openQrModal = function(id) {
  const link = linksList.find(l => l.id === id);
  if (!link) return;

  modalTitle.textContent = link.title;
  modalShortUrl.textContent = link.shortUrl;
  modalQrImg.src = link.qrCode;
  modalDownloadBtn.href = link.qrCode;
  modalDownloadBtn.download = `qr-${link.code}.png`;

  qrModal.style.display = 'flex';
};

closeModalBtn.addEventListener('click', () => {
  qrModal.style.display = 'none';
});

qrModal.addEventListener('click', (e) => {
  if (e.target === qrModal) {
    qrModal.style.display = 'none';
  }
});

// Paste button
pasteBtn.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) originalUrlInput.value = text;
  } catch (err) {
    originalUrlInput.focus();
  }
});

// Refresh button
refreshBtn.addEventListener('click', () => {
  fetchLinks();
  fetchStats();
});

// Initial load & periodic stats polling
fetchLinks();
fetchStats();
setInterval(fetchStats, 15000);
