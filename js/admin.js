/* ==========================================================
   ADMIN.JS — Supabase Auth–protected dashboard for managing
   writings, projects, and viewing feedback messages.

   Three tabs:
   1. Writings  — create & manage blog posts
   2. Projects  — create & manage project entries
   3. Feedback  — read messages submitted by visitors
*/

document.addEventListener('DOMContentLoaded', async () => {
  // Check for an existing Supabase Auth session
  const { data: { session } } = await db.auth.getSession();

  if (session) {
    showDashboard();
  } else {
    showLoginScreen();
  }
});


/* ==========================================================
   Login Screen — Supabase Auth (email + password)
   ========================================================== */

function showLoginScreen() {
  const main = document.getElementById('admin-container');
  main.innerHTML = `
    <div class="lock-screen">
      <h2>Admin Access</h2>
      <p style="margin-bottom:var(--space-lg);">
        Sign in with your admin account to manage your site.
      </p>
      <div class="form-group">
        <input type="email" id="admin-email"
               placeholder="Email" autocomplete="email">
      </div>
      <div class="form-group">
        <input type="password" id="admin-password"
               placeholder="Password" autocomplete="current-password">
      </div>
      <button class="btn btn-primary" id="login-btn">Sign in</button>
      <p id="login-error"
         style="color:#B5594E; margin-top:var(--space-md); display:none;">
      </p>
    </div>
  `;

  document.getElementById('login-btn')
    .addEventListener('click', attemptLogin);
  document.getElementById('admin-password')
    .addEventListener('keydown', (e) => {
      if (e.key === 'Enter') attemptLogin();
    });
}

async function attemptLogin() {
  const email    = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-password').value;
  const errorEl  = document.getElementById('login-error');
  const btn      = document.getElementById('login-btn');

  if (!email || !password) {
    errorEl.textContent = 'Please enter your email and password.';
    errorEl.style.display = 'block';
    return;
  }

  btn.textContent = 'Signing in...';
  btn.disabled = true;

  const { data, error } = await db.auth.signInWithPassword({ email, password });

  if (error) {
    errorEl.textContent = error.message || 'Invalid email or password.';
    errorEl.style.display = 'block';
    btn.textContent = 'Sign in';
    btn.disabled = false;
    return;
  }

  // Authenticated — show the dashboard
  showDashboard();
}


/* ==========================================================
   Dashboard Shell — Tab Navigation
   ========================================================== */

let activeTab = 'writings';

function showDashboard() {
  const main = document.getElementById('admin-container');
  main.innerHTML = `
    <!-- Header bar -->
    <div style="display:flex; justify-content:space-between; align-items:center;
                margin-bottom:var(--space-lg);">
      <h2>Dashboard</h2>
      <button class="btn btn-secondary" id="logout-btn">Sign out</button>
    </div>

    <!-- Tab navigation -->
    <div class="admin-tabs" id="admin-tabs">
      <button class="admin-tab active" data-tab="writings">Writings</button>
      <button class="admin-tab" data-tab="projects">Projects</button>
      <button class="admin-tab" data-tab="feedback">Feedback</button>
    </div>

    <!-- Tab content panels -->
    <div id="tab-content"></div>
  `;

  // Wire up sign-out
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await db.auth.signOut();
    showLoginScreen();
  });

  // Wire up tab buttons
  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTabContent();
    });
  });

  // Render the default tab
  renderTabContent();
}

function renderTabContent() {
  const panel = document.getElementById('tab-content');
  switch (activeTab) {
    case 'writings':  renderWritingsTab(panel);  break;
    case 'projects':  renderProjectsTab(panel);  break;
    case 'feedback':  renderFeedbackTab(panel);  break;
  }
}


/* ==========================================================
   TAB 1: Writings
   ========================================================== */

function renderWritingsTab(panel) {
  panel.innerHTML = `
    <div class="section">
      <p class="section-label">New Writing</p>
      <div class="form-group">
        <label for="post-title">Title</label>
        <input type="text" id="post-title"
               placeholder="Give your writing a title">
      </div>
      <div class="form-group">
        <label for="post-content">Content</label>
        <textarea id="post-content" rows="12"
                  placeholder="Write your piece here. Use blank lines to separate paragraphs."></textarea>
      </div>
      <button class="btn btn-primary" id="publish-post-btn">Publish</button>
    </div>

    <hr class="divider">

    <div class="section">
      <p class="section-label">Existing Writings</p>
      <div id="existing-posts">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-text"></div>
      </div>
    </div>
  `;

  document.getElementById('publish-post-btn')
    .addEventListener('click', publishPost);
  loadExistingPosts();
}

async function publishPost() {
  const titleInput   = document.getElementById('post-title');
  const contentInput = document.getElementById('post-content');
  const title   = titleInput.value.trim();
  const content = contentInput.value.trim();

  if (!title || !content) {
    showToast('Please fill in both the title and content.', 'error');
    return;
  }

  const btn = document.getElementById('publish-post-btn');
  btn.textContent = 'Publishing...';
  btn.disabled = true;

  try {
    const { error } = await db
      .from('posts')
      .insert([{ title, content, published: true }]);

    if (error) throw error;

    titleInput.value   = '';
    contentInput.value = '';
    showToast('Published successfully!', 'success');
    loadExistingPosts();
  } catch (err) {
    console.error('Error publishing post:', err);
    showToast('Failed to publish. Check your Supabase setup.', 'error');
  } finally {
    btn.textContent = 'Publish';
    btn.disabled = false;
  }
}

async function loadExistingPosts() {
  const container = document.getElementById('existing-posts');
  if (!container) return;

  try {
    const { data: posts, error } = await db
      .from('posts')
      .select('id, title, created_at, published')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!posts || posts.length === 0) {
      container.innerHTML = `
        <p style="color:var(--sage);">No posts yet. Write your first one above.</p>`;
      return;
    }

    container.innerHTML = posts.map(post => `
      <div class="card admin-list-card">
        <div class="admin-list-info">
          <span class="card-title">${escapeHtml(post.title)}</span>
          <span class="card-meta">${formatDate(post.created_at)}</span>
          ${!post.published ? '<span class="tag">draft</span>' : ''}
        </div>
        <div class="admin-list-actions">
          <button class="btn btn-secondary"
                  onclick="togglePostPublish('${post.id}', ${post.published})">
            ${post.published ? 'Unpublish' : 'Publish'}
          </button>
          <button class="btn btn-secondary btn-danger"
                  onclick="deletePost('${post.id}')">
            Delete
          </button>
        </div>
      </div>
    `).join('');

  } catch (err) {
    console.error('Error loading posts:', err);
    container.innerHTML = `
      <p style="color:var(--sage);">Unable to load posts.</p>`;
  }
}

async function togglePostPublish(id, currentState) {
  try {
    const { error } = await db
      .from('posts')
      .update({ published: !currentState })
      .eq('id', id);
    if (error) throw error;
    showToast(currentState ? 'Post unpublished.' : 'Post published!', 'success');
    loadExistingPosts();
  } catch (err) {
    showToast('Failed to update post.', 'error');
  }
}

async function deletePost(id) {
  if (!confirm('Delete this post? This cannot be undone.')) return;
  try {
    const { error } = await db
      .from('posts').delete().eq('id', id);
    if (error) throw error;
    showToast('Post deleted.', 'success');
    loadExistingPosts();
  } catch (err) {
    showToast('Failed to delete post.', 'error');
  }
}


/* ==========================================================
   TAB 2: Projects
   ========================================================== */

function renderProjectsTab(panel) {
  panel.innerHTML = `
    <div class="section">
      <p class="section-label">New Project</p>
      <div class="form-group">
        <label for="proj-title">Title</label>
        <input type="text" id="proj-title"
               placeholder="Project name">
      </div>
      <div class="form-group">
        <label for="proj-status">Status</label>
        <select id="proj-status">
          <option value="current">Current</option>
          <option value="recent">Recent</option>
          <option value="archived">Archived</option>
        </select>
      </div>
      <div class="form-group">
        <label for="proj-summary">Summary</label>
        <textarea id="proj-summary" rows="3"
                  placeholder="Short description shown on the home page card."></textarea>
      </div>
      <div class="form-group">
        <label for="proj-description">Full Description</label>
        <textarea id="proj-description" rows="10"
                  placeholder="Detailed write-up shown on the project page. Use blank lines for paragraphs."></textarea>
      </div>
      <div class="form-group">
        <label for="proj-tags">Tags (comma-separated)</label>
        <input type="text" id="proj-tags"
               placeholder="e.g. python, web, data-science">
      </div>
      <div class="form-group">
        <label for="proj-link">External Link (optional)</label>
        <input type="text" id="proj-link"
               placeholder="https://github.com/...">
      </div>
      <button class="btn btn-primary" id="publish-proj-btn">Publish Project</button>
    </div>

    <hr class="divider">

    <div class="section">
      <p class="section-label">Existing Projects</p>
      <div id="existing-projects">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-text"></div>
      </div>
    </div>
  `;

  document.getElementById('publish-proj-btn')
    .addEventListener('click', publishProject);
  loadExistingProjects();
}

async function publishProject() {
  const title       = document.getElementById('proj-title').value.trim();
  const status      = document.getElementById('proj-status').value;
  const summary     = document.getElementById('proj-summary').value.trim();
  const description = document.getElementById('proj-description').value.trim();
  const tags        = document.getElementById('proj-tags').value.trim();
  const link        = document.getElementById('proj-link').value.trim();

  if (!title || !summary || !description) {
    showToast('Please fill in the title, summary, and description.', 'error');
    return;
  }

  const btn = document.getElementById('publish-proj-btn');
  btn.textContent = 'Publishing...';
  btn.disabled = true;

  try {
    const { error } = await db
      .from('projects')
      .insert([{ title, status, summary, description, tags, link, published: true }]);

    if (error) throw error;

    document.getElementById('proj-title').value       = '';
    document.getElementById('proj-summary').value     = '';
    document.getElementById('proj-description').value = '';
    document.getElementById('proj-tags').value        = '';
    document.getElementById('proj-link').value        = '';
    showToast('Project published!', 'success');
    loadExistingProjects();
  } catch (err) {
    console.error('Error publishing project:', err);
    showToast('Failed to publish project.', 'error');
  } finally {
    btn.textContent = 'Publish Project';
    btn.disabled = false;
  }
}

async function loadExistingProjects() {
  const container = document.getElementById('existing-projects');
  if (!container) return;

  try {
    const { data: projects, error } = await db
      .from('projects')
      .select('id, title, status, created_at, published')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!projects || projects.length === 0) {
      container.innerHTML = `
        <p style="color:var(--sage);">No projects yet. Create one above.</p>`;
      return;
    }

    container.innerHTML = projects.map(proj => `
      <div class="card admin-list-card">
        <div class="admin-list-info">
          <span class="card-title">${escapeHtml(proj.title)}</span>
          <span class="card-meta">${formatDate(proj.created_at)}</span>
          <span class="tag ${proj.status === 'current' ? 'active-tag' : ''}">
            ${escapeHtml(proj.status)}
          </span>
          ${!proj.published ? '<span class="tag">draft</span>' : ''}
        </div>
        <div class="admin-list-actions">
          <button class="btn btn-secondary"
                  onclick="toggleProjectPublish('${proj.id}', ${proj.published})">
            ${proj.published ? 'Unpublish' : 'Publish'}
          </button>
          <button class="btn btn-secondary btn-danger"
                  onclick="deleteProject('${proj.id}')">
            Delete
          </button>
        </div>
      </div>
    `).join('');

  } catch (err) {
    console.error('Error loading projects:', err);
    container.innerHTML = `
      <p style="color:var(--sage);">Unable to load projects.</p>`;
  }
}

async function toggleProjectPublish(id, currentState) {
  try {
    const { error } = await db
      .from('projects')
      .update({ published: !currentState })
      .eq('id', id);
    if (error) throw error;
    showToast(currentState ? 'Project unpublished.' : 'Project published!', 'success');
    loadExistingProjects();
  } catch (err) {
    showToast('Failed to update project.', 'error');
  }
}

async function deleteProject(id) {
  if (!confirm('Delete this project? This cannot be undone.')) return;
  try {
    const { error } = await db
      .from('projects').delete().eq('id', id);
    if (error) throw error;
    showToast('Project deleted.', 'success');
    loadExistingProjects();
  } catch (err) {
    showToast('Failed to delete project.', 'error');
  }
}


/* ==========================================================
   TAB 3: Feedback Inbox
   ========================================================== */

function renderFeedbackTab(panel) {
  panel.innerHTML = `
    <div class="section">
      <p class="section-label">Visitor Feedback</p>
      <div id="feedback-list">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-text"></div>
      </div>
    </div>
  `;
  loadFeedback();
}

async function loadFeedback() {
  const container = document.getElementById('feedback-list');
  if (!container) return;

  try {
    const { data: messages, error } = await db
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!messages || messages.length === 0) {
      container.innerHTML = `
        <p style="color:var(--sage);">No feedback yet.</p>`;
      return;
    }

    container.innerHTML = messages.map(msg => `
      <div class="card ${msg.is_read ? '' : 'feedback-unread'}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <strong>${escapeHtml(msg.name)}</strong>
            <span class="card-meta" style="margin-left:var(--space-sm);">
              ${formatDate(msg.created_at)}
            </span>
            ${!msg.is_read ? '<span class="tag active-tag" style="font-size:0.65rem;">new</span>' : ''}
          </div>
          <div class="admin-list-actions">
            ${!msg.is_read
              ? `<button class="btn btn-secondary" style="font-size:0.75rem; padding:4px 12px;"
                         onclick="markFeedbackRead('${msg.id}')">
                   Mark read
                 </button>`
              : ''}
            <button class="btn btn-secondary btn-danger" style="font-size:0.75rem; padding:4px 12px;"
                    onclick="deleteFeedback('${msg.id}')">
              Delete
            </button>
          </div>
        </div>
        <p class="card-meta" style="margin-top:var(--space-xs); margin-bottom:var(--space-xs);">
          Re: ${escapeHtml(msg.context_title || 'General')}
          <span class="tag" style="margin-left:var(--space-xs);">${escapeHtml(msg.context_type)}</span>
        </p>
        <p class="card-description" style="white-space:pre-wrap;">${escapeHtml(msg.message)}</p>
      </div>
    `).join('');

  } catch (err) {
    console.error('Error loading feedback:', err);
    container.innerHTML = `
      <p style="color:var(--sage);">Unable to load feedback.</p>`;
  }
}

async function markFeedbackRead(id) {
  try {
    const { error } = await db
      .from('feedback')
      .update({ is_read: true })
      .eq('id', id);
    if (error) throw error;
    loadFeedback();
  } catch (err) {
    showToast('Failed to update.', 'error');
  }
}

async function deleteFeedback(id) {
  if (!confirm('Delete this feedback message?')) return;
  try {
    const { error } = await db
      .from('feedback').delete().eq('id', id);
    if (error) throw error;
    showToast('Feedback deleted.', 'success');
    loadFeedback();
  } catch (err) {
    showToast('Failed to delete.', 'error');
  }
}
