/* ==========================================================
   WRITINGS.JS — Fetches and displays blog posts from Supabase
   ==========================================================
   Two views:
   1. Post LIST   — shows all published posts as cards
   2. Post DETAIL — shows a single post when ?id=<uuid> is
      present in the URL, with a feedback form at the bottom
      that submits to the Supabase 'feedback' table.
*/

document.addEventListener('DOMContentLoaded', () => {
  // Only run on pages that have a #posts-container element
  if (!document.getElementById('posts-container')) return;

  const params = new URLSearchParams(window.location.search);
  const postId = params.get('id');

  if (postId) {
    loadSinglePost(postId);
  } else {
    loadAllPosts();
  }
});


/* ==========================================================
   Post List View
   ========================================================== */

async function loadAllPosts() {
  const container = document.getElementById('posts-container');

  // Show loading skeletons
  container.innerHTML = skeletonCards(3);

  try {
    const { data: posts, error } = await db
      .from('posts')
      .select('id, title, content, created_at')
      .eq('published', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!posts || posts.length === 0) {
      container.innerHTML = `
        <p style="text-align:center; color:var(--sage); margin-top:var(--space-2xl);">
          No writings yet — check back soon.
        </p>`;
      return;
    }

    container.innerHTML = posts.map(post => `
      <a href="writings.html?id=${post.id}" class="card"
         style="display:block; text-decoration:none;">
        <h3 class="card-title">${escapeHtml(post.title)}</h3>
        <span class="card-meta">${formatDate(post.created_at)}</span>
        <p class="card-description">${truncate(post.content, 180)}</p>
      </a>
    `).join('');

  } catch (err) {
    console.error('Error loading posts:', err);
    container.innerHTML = `
      <p style="color:var(--sage); text-align:center;">
        Unable to load writings. Please check your Supabase configuration.
      </p>`;
  }
}


/* ==========================================================
   Single Post Detail View
   ========================================================== */

async function loadSinglePost(id) {
  const container = document.getElementById('posts-container');

  container.innerHTML = `
    <div class="skeleton skeleton-title"></div>
    <div class="skeleton skeleton-text"></div>
    <div class="skeleton skeleton-text"></div>
    <div class="skeleton skeleton-text"></div>`;

  try {
    const { data: post, error } = await db
      .from('posts')
      .select('*')
      .eq('id', id)
      .eq('published', true)
      .single();

    if (error || !post) {
      container.innerHTML = `
        <p style="text-align:center;">Post not found.</p>
        <p style="text-align:center;">
          <a href="writings.html">&larr; Back to all writings</a>
        </p>`;
      return;
    }

    // Render the full post with a feedback form (no email exposed)
    container.innerHTML = `
      <a href="writings.html" style="font-size:var(--size-sm); color:var(--sage);">
        &larr; back to all writings
      </a>

      <h1 style="margin-top:var(--space-lg);">${escapeHtml(post.title)}</h1>
      <span class="card-meta">${formatDate(post.created_at)}</span>

      <hr class="divider">

      <div class="post-content">
        ${renderContent(post.content)}
      </div>

      <!-- Feedback Form — submits to Supabase, no email exposed -->
      <div class="feedback-section" id="feedback-section">
        <h3>Thoughts or feedback?</h3>
        <p>I'd love to hear from you — leave a message below.</p>
        <form id="feedback-form"
              style="text-align:left; max-width:500px; margin:0 auto;">
          <div class="form-group">
            <label for="feedback-name">Your name</label>
            <input type="text" id="feedback-name"
                   placeholder="Name" required>
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

    // Wire up feedback form submission
    document.getElementById('feedback-form').addEventListener('submit', (e) => {
      e.preventDefault();
      submitWritingFeedback(post.id, post.title);
    });

  } catch (err) {
    console.error('Error loading post:', err);
    container.innerHTML = `
      <p style="color:var(--sage); text-align:center;">
        Something went wrong loading this post.
      </p>`;
  }
}


/* ==========================================================
   Feedback Submission (for writings)
   ========================================================== */

/* Submits feedback to the Supabase 'feedback' table,
   tagged with context_type = 'writing'. */
async function submitWritingFeedback(postId, postTitle) {
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
        context_type:  'writing',
        context_id:    postId,
        context_title: postTitle,
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

/* Escape HTML to prevent XSS when rendering user content */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* Convert plain text content into paragraphs */
function renderContent(text) {
  return text
    .split(/\n\n+/)
    .map(para => `<p>${escapeHtml(para.trim())}</p>`)
    .join('');
}

/* Truncate text to a max length, adding ellipsis */
function truncate(text, maxLength) {
  const clean = text.replace(/\n+/g, ' ');
  if (clean.length <= maxLength) return escapeHtml(clean);
  return escapeHtml(clean.substring(0, maxLength).trim()) + '&hellip;';
}

/* Format an ISO date string to readable format */
function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    year:  'numeric',
    month: 'long',
    day:   'numeric',
  });
}

/* Generate skeleton loading cards */
function skeletonCards(count) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="card">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text"></div>
      </div>`;
  }
  return html;
}
