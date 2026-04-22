/* ==========================================================
   PROJECTS.JS — Fetches and displays projects from Supabase
   ==========================================================
   Two views:
   1. Home page (index.html) — renders project cards with links
   2. Project detail (project.html?id=<uuid>) — full write-up
      with a feedback form that submits to Supabase

   Projects are managed via the Admin dashboard, not this file.
*/

document.addEventListener('DOMContentLoaded', () => {
  renderProjectCards();
  renderProjectDetail();
});


/* ==========================================================
   Home Page — Project Card List
   ========================================================== */

/* Fetch all published projects from Supabase and render
   them as clickable cards inside #projects-container. */
async function renderProjectCards() {
  const container = document.getElementById('projects-container');
  if (!container) return;

  // Show skeleton loaders while fetching
  container.innerHTML = skeletonCardsProjects(3);

  try {
    const { data: projects, error } = await db
      .from('projects')
      .select('id, title, status, summary')
      .eq('published', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!projects || projects.length === 0) {
      container.innerHTML = `
        <p style="text-align:center; color:var(--sage); margin-top:var(--space-2xl);">
          No projects yet — check back soon.
        </p>`;
      return;
    }

    container.innerHTML = projects.map(project => `
      <a href="project.html?id=${project.id}" class="card"
         style="display:block; text-decoration:none; color:inherit;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 class="card-title">${escapeHtmlSafe(project.title)}</h3>
          <span class="tag ${project.status === 'current' ? 'active-tag' : ''}">
            ${escapeHtmlSafe(project.status)}
          </span>
        </div>
        <p class="card-description">${escapeHtmlSafe(project.summary)}</p>
      </a>
    `).join('');

  } catch (err) {
    console.error('Error loading projects:', err);
    container.innerHTML = `
      <p style="color:var(--sage); text-align:center;">
        Unable to load projects. Check back in later.
      </p>`;
  }
}


/* ==========================================================
   Project Detail Page
   ========================================================== */

/* Fetch a single project by UUID and render the full detail
   view with tags, description, and a feedback form. */
async function renderProjectDetail() {
  const container = document.getElementById('project-detail');
  if (!container) return;

  // Get the project ID from the URL query string
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    container.innerHTML = `
      <p style="text-align:center;">No project specified.</p>
      <p style="text-align:center;">
        <a href="index.html">&larr; Back to home</a>
      </p>`;
    return;
  }

  // Show loading skeletons
  container.innerHTML = `
    <div class="skeleton skeleton-title"></div>
    <div class="skeleton skeleton-text"></div>
    <div class="skeleton skeleton-text"></div>
    <div class="skeleton skeleton-text"></div>`;

  try {
    const { data: project, error } = await db
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('published', true)
      .single();

    if (error || !project) {
      container.innerHTML = `
        <p style="text-align:center;">Project not found.</p>
        <p style="text-align:center;">
          <a href="index.html">&larr; Back to home</a>
        </p>`;
      return;
    }

    // Update the browser tab title
    document.title = `${project.title} — ${SITE_NAME}`;

    // Parse comma-separated tags into badges
    const tagsHtml = project.tags
      ? project.tags.split(',').filter(t => t.trim()).map(t =>
          `<span class="tag">${escapeHtmlSafe(t.trim())}</span>`
        ).join('')
      : '';

    // Optional external link button (sanitised to block javascript: URIs)
    const safeLink = sanitizeUrl(project.link);
    const linkHtml = safeLink
      ? `<a href="${escapeHtmlSafe(safeLink)}" target="_blank" rel="noopener"
            class="btn btn-secondary" style="margin-top:var(--space-md);">
           View project &rarr;
         </a>`
      : '';

    // Render the full detail view
    container.innerHTML = `
      <a href="index.html" style="font-size:var(--size-sm); color:var(--sage);">
        &larr; back to home
      </a>

      <h1 style="margin-top:var(--space-lg);">${escapeHtmlSafe(project.title)}</h1>

      <div style="margin-bottom:var(--space-md);">
        <span class="tag ${project.status === 'current' ? 'active-tag' : ''}">
          ${escapeHtmlSafe(project.status)}
        </span>
        ${tagsHtml}
      </div>

      <hr class="divider">

      <div class="post-content">
        ${renderParagraphs(project.description)}
      </div>

      ${linkHtml}

      <!-- Feedback Form (submits to Supabase, no email exposed) -->
      <div class="feedback-section" id="feedback-section">
        <h3>Questions about this project?</h3>
        <p>I'd love to hear from you — leave a message below.</p>
        <form id="feedback-form" style="text-align:left; max-width:500px; margin:0 auto;">
          <div class="form-group">
            <label for="feedback-name">Your name</label>
            <input type="text" id="feedback-name" placeholder="Name" required>
          </div>
          <div class="form-group">
            <label for="feedback-message">Message</label>
            <textarea id="feedback-message" rows="4"
                      placeholder="Write your message here..." required></textarea>
          </div>
          <button type="submit" class="btn btn-primary" id="feedback-submit">
            Send message
          </button>
        </form>
      </div>
    `;

    // Wire up the feedback form
    document.getElementById('feedback-form').addEventListener('submit', (e) => {
      e.preventDefault();
      submitFeedback('project', project.id, project.title);
    });

  } catch (err) {
    console.error('Error loading project:', err);
    container.innerHTML = `
      <p style="color:var(--sage); text-align:center;">
        Something went wrong loading this project.
      </p>`;
  }
}


/* ==========================================================
   Feedback Submission
   ========================================================== */

/* Submit a feedback message to the Supabase 'feedback' table.
   Used by both the project detail page and the writings page. */
async function submitFeedback(contextType, contextId, contextTitle) {
  const nameInput    = document.getElementById('feedback-name');
  const messageInput = document.getElementById('feedback-message');
  const btn          = document.getElementById('feedback-submit');

  const name    = nameInput.value.trim();
  const message = messageInput.value.trim();

  if (!name || !message) {
    showToast('Please fill in your name and message.', 'error');
    return;
  }

  btn.textContent = 'Sending...';
  btn.disabled = true;

  try {
    const { error } = await db
      .from('feedback')
      .insert([{
        name,
        message,
        context_type:  contextType,
        context_id:    contextId,
        context_title: contextTitle,
      }]);

    if (error) throw error;

    // Replace the form with a thank-you message
    const section = document.getElementById('feedback-section');
    section.innerHTML = `
      <h3>Thank you!</h3>
      <p>Your message has been received. I'll get back to you soon.</p>
    `;

  } catch (err) {
    console.error('Error submitting feedback:', err);
    showToast('Failed to send message. Please try again.', 'error');
    btn.textContent = 'Send message';
    btn.disabled = false;
  }
}


/* ==========================================================
   Helper Functions
   ========================================================== */

/* Only allow http(s) URLs — blocks javascript:, data:, etc. */
function sanitizeUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch (_) { /* invalid URL, fall through */ }
  return '';
}

/* Escape HTML entities to prevent XSS */
function escapeHtmlSafe(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* Split text on double newlines and wrap each in <p> */
function renderParagraphs(text) {
  return text
    .split(/\n\n+/)
    .map(para => `<p>${escapeHtmlSafe(para.trim())}</p>`)
    .join('');
}

/* Skeleton loader cards for the project list */
function skeletonCardsProjects(count) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="card">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-text"></div>
      </div>`;
  }
  return html;
}
