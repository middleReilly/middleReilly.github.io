/* ==========================================================
   NAV.JS — Shared navigation & footer injection
   ==========================================================
   Dynamically builds the site header and footer so every
   page stays consistent. Edit links here once instead of
   touching every HTML file.
*/

document.addEventListener('DOMContentLoaded', () => {
  buildHeader();
  buildFooter();
});


/* --- Build the minimal header ---
   Inserts a <header> at the top of <body> with the site
   name on the left and navigation links on the right.
*/
function buildHeader() {
  // Figure out which page is currently active
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';

  // Define navigation links (label → filename)
  const links = [
    { label: 'home',     href: 'index.html'    },
    { label: 'about',    href: 'about.html'    },
    { label: 'writings', href: 'writings.html' },
  ];

  // Build the nav links HTML
  const navLinks = links.map(link => {
    const isActive = currentPage === link.href ? ' active' : '';
    return `<a href="${link.href}" class="${isActive}">${link.label}</a>`;
  }).join('');

  // Create the header element
  const header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = `
    <a href="index.html" class="site-name">${SITE_NAME}</a>
    <nav class="site-nav">
      ${navLinks}
    </nav>
  `;

  // Insert at the very top of body
  document.body.insertBefore(header, document.body.firstChild);
}


/* --- Build the footer ---
   Appends a simple footer at the bottom of the page.
*/
function buildFooter() {
  const year = new Date().getFullYear();

  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `&copy; ${year} ${SITE_NAME}. All rights reserved.`;

  document.body.appendChild(footer);
}


/* --- Toast notification helper ---
   Shows a brief pop-up message (success or error).
   Usage: showToast('Post published!', 'success');
*/
function showToast(message, type = 'success') {
  // Remove any existing toast
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger the show animation
  requestAnimationFrame(() => toast.classList.add('show'));

  // Auto-dismiss after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
