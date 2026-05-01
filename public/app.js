// Simple localStorage model and navigation helpers
const STORAGE_KEY = "taskTogetherState.v1";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw)
      return {
        users: {},
        currentUserId: null,
        groups: {},
        groupOrder: [],
        notifications: [],
      };
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to load state", e);
    return {
      users: {},
      currentUserId: null,
      groups: {},
      groupOrder: [],
      notifications: [],
    };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// Generate reminder notifications for tasks due soon (default 3 days)
function refreshDeadlineNotifications(daysAhead = 3) {
  const s = loadState();
  if (!s.notifiedDue) s.notifiedDue = {}; // taskId -> true when notified
  const now = Date.now();
  const horizon = now + daysAhead * 24 * 60 * 60 * 1000;
  Object.values(s.groups || {}).forEach((g) => {
    (g.tasks || []).forEach((t) => {
      if (!t || !t.dueDate || t.done) return;
      const dueTs = new Date(t.dueDate).getTime();
      if (Number.isNaN(dueTs)) return;
      if (dueTs >= now && dueTs <= horizon && !s.notifiedDue[t.id]) {
        const days = Math.max(1, Math.ceil((dueTs - now) / (24 * 60 * 60 * 1000)));
        s.notifications.unshift({
          id: crypto.randomUUID(),
          text: `Reminder: "${t.name}" is due in ${days} day${days > 1 ? 's' : ''} in group "${g.name}"`,
          ts: Date.now(),
        });
        s.notifiedDue[t.id] = true;
      }
    });
  });
  saveState(s);
}

function ensureSeed() {
  const state = loadState();
  if (!state.seeded) {
    const userId = crypto.randomUUID();
    state.users[userId] = {
      id: userId,
      name: "Guest",
      email: "guest@example.com",
      role: "leader",
    };
    state.currentUserId = userId;

    const groupId = crypto.randomUUID();
    state.groups[groupId] = {
      id: groupId,
      name: "Marketing Project",
      members: [userId],
      roles: { [userId]: "owner" },
      visibility: "team", // private | team | public
      projects: [],
      tasks: [],
      chat: [],
    };
    // default project
    const defaultProjectId = crypto.randomUUID();
    state.groups[groupId].projects.push({
      id: defaultProjectId,
      name: "Website redesign",
    });
    state.groupOrder = [groupId];
    state.seeded = true;
    saveState(state);
  }
}

function getCurrentUser() {
  const s = loadState();
  return s.currentUserId ? s.users[s.currentUserId] : null;
}

function setCurrentUser(user) {
  const s = loadState();
  s.users[user.id] = user;
  s.currentUserId = user.id;
  saveState(s);
}

function createGroup(name, memberEmailsCsv) {
  const s = loadState();
  const id = crypto.randomUUID();
  const current = s.currentUserId;
  // Only leaders can create groups
  const currentUser = s.users[current];
  if (!currentUser || currentUser.role !== "leader") {
    alert && alert("Only group leaders can create groups.");
    return null;
  }
  const memberIds = [current];
  const emails = (memberEmailsCsv || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  emails.forEach((email) => {
    const uid = crypto.randomUUID();
    s.users[uid] = { id: uid, name: email.split("@")[0] || "User", email };
    memberIds.push(uid);
  });
  s.groups[id] = {
    id,
    name,
    members: memberIds,
    roles: { [current]: "owner" },
    visibility: "team",
    projects: [],
    tasks: [],
    chat: [],
  };
  const projectId = crypto.randomUUID();
  s.groups[id].projects.push({ id: projectId, name: "General" });
  s.groupOrder.unshift(id);
  s.notifications.unshift({
    id: crypto.randomUUID(),
    text: `Group created: ${name}`,
    ts: Date.now(),
  });
  saveState(s);
  return id;
}

function createTask(groupId, task) {
  const s = loadState();
  const current = s.currentUserId;
  if (!canEditGroup(groupId, current)) {
    alert && alert("Only group leaders can add tasks.");
    return null;
  }
  const id = crypto.randomUUID();
  const payload = {
    id,
    name: task.name,
    projectId: task.projectId || s.groups[groupId].projects[0]?.id || null,
    description: task.description || "",
    comments: [],
    labels: (task.labels || []).slice(0, 8),
    dueDate: task.dueDate || null,
    assigneeId: task.assigneeId || null,
    status: task.status || "todo",
    done: false,
  };
  s.groups[groupId].tasks.unshift(payload);
  s.notifications.unshift({
    id: crypto.randomUUID(),
    text: `New task in ${s.groups[groupId].name}: ${task.name}`,
    ts: Date.now(),
  });
  saveState(s);
  return id;
}

function updateTask(groupId, taskId, updates) {
  const s = loadState();
  const t = s.groups[groupId].tasks.find((x) => x.id === taskId);
  if (!t) return;
  Object.assign(t, updates);
  saveState(s);
}

// Projects
function createProject(groupId, name) {
  const s = loadState();
  const current = s.currentUserId;
  if (!canEditGroup(groupId, current)) {
    alert && alert("Only group leaders can add projects.");
    return null;
  }
  const id = crypto.randomUUID();
  const g = s.groups[groupId];
  if (!g) return null;
  g.projects.push({ id, name });
  saveState(s);
  return id;
}

// Permissions
function userRoleInGroup(groupId, userId) {
  const s = loadState();
  const g = s.groups[groupId];
  if (!g) return null;
  return g.roles[userId] || "member";
}
function canEditGroup(groupId, userId) {
  const s = loadState();
  const user = s.users[userId];
  if (user && user.role === "leader") return true;
  const role = userRoleInGroup(groupId, userId);
  return role === "owner";
}

// Delete task
function deleteTask(groupId, taskId) {
  const s = loadState();
  const g = s.groups[groupId];
  if (!g) return;
  const current = s.currentUserId;
  if (!canEditGroup(groupId, current)) {
    alert && alert("Only group leaders can delete tasks.");
    return;
  }
  g.tasks = g.tasks.filter((t) => t.id !== taskId);
  saveState(s);
}

// Chat via BroadcastChannel (cross-tab) and localStorage persistence
const chatChannels = {};

function getChatChannel(groupId) {
  if (!chatChannels[groupId]) {
    chatChannels[groupId] = new BroadcastChannel(
      `taskTogether.chat.${groupId}`
    );
  }
  return chatChannels[groupId];
}

function postChatMessage(groupId, userId, text) {
  const s = loadState();
  const msg = { id: crypto.randomUUID(), userId, text, ts: Date.now() };
  s.groups[groupId].chat.push(msg);
  saveState(s);
  getChatChannel(groupId).postMessage({ type: "chat", groupId, message: msg });
  return msg;
}

// Helpers for common UI pieces
function renderHeader(targetEl, opts) {
  const user = getCurrentUser();
  const isPublic = opts?.public === true || !user;
  if (opts?.sloganOnly) {
    targetEl.innerHTML = `
      <div class="brand"><img src="logo.svg" alt="TaskTogether logo" class="logo-img"/> TaskTogether</div>
      <div class="slogan">Find Your Collaborative Groove</div>
    `;
    return;
  }
  // Simplified public header (no dropdowns, anchor links on same page)
  if (isPublic && opts?.simplePublic) {
    targetEl.innerHTML = `
      <div class="brand"><img src="logo.svg" alt="TaskTogether logo" class="logo-img"/> Task Together</div>
      <nav class="nav nav-public">
        <a href="#features">Features</a>
        <a href="#about">About</a>
        <a href="team.html">Task Together team</a>
        <a class="btn ghost" href="login.html">Log in</a>
        <button class="nav-toggle" aria-label="Toggle menu" aria-expanded="false">☰</button>
      </nav>
    `;
    enhanceHeaderUX(targetEl, true);
    return;
  }
  if (isPublic) {
    targetEl.innerHTML = `
      <div class="brand"><img src="logo.svg" alt="TaskTogether logo" class="logo-img"/> TaskTogether</div>
      <nav class="nav nav-public">
        <div class="menu">
          <button class="menu-trigger">About</button>
          <div class="menu-list">
            <a href="about.html">What is TaskTogether?</a>
            <a href="team.html">Our team</a>
          </div>
        </div>
        <div class="menu">
          <button class="menu-trigger">Features</button>
          <div class="menu-list">
            <a href="features.html#boards">MY PROJECTS</a>
            <a href="features.html#inbox">Inbox</a>
            <a href="features.html#chat">Chat</a>
          </div>
        </div>
        <div class="menu">
          <button class="menu-trigger">Solutions</button>
          <div class="menu-list">
            <a href="solutions.html#personal">Personal</a>
            <a href="solutions.html#teams">Teams</a>
            <a href="solutions.html#education">Education</a>
          </div>
        </div>
        <a class="btn ghost" href="login.html">Log in</a>
        <button class="nav-toggle" aria-label="Toggle menu" aria-expanded="false">☰</button>
      </nav>
    `;
    attachMenus(targetEl);
    enhanceHeaderUX(targetEl, true);
    return;
  }
  targetEl.innerHTML = `
    <div class="brand"><img src="logo.svg" alt="TaskTogether logo" class="logo-img"/> TaskTogether</div>
    <div class="nav">
      <a href="dashboard.html">Dashboard</a>
      <a href="notifications.html">Notifications</a>
      <a href="profile.html">${user ? user.name : "Profile"}</a>
    </div>
  `;
  enhanceHeaderUX(targetEl, false);
}

function attachMenus(root) {
  const triggers = root.querySelectorAll(".menu-trigger");
  triggers.forEach((btn) => {
    const menu = btn.parentElement.querySelector(".menu-list");
    btn.addEventListener("click", () => {
      const open = menu.getAttribute("data-open") === "true";
      root
        .querySelectorAll(".menu-list")
        .forEach((m) => m.setAttribute("data-open", "false"));
      menu.setAttribute("data-open", open ? "false" : "true");
    });
  });
  document.addEventListener("click", (e) => {
    if (!root.contains(e.target)) {
      root
        .querySelectorAll(".menu-list")
        .forEach((m) => m.setAttribute("data-open", "false"));
    }
  });
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString();
}

// Expose for pages
window.TaskTogether = {
  ensureSeed,
  loadState,
  saveState,
  refreshDeadlineNotifications,
  getCurrentUser,
  setCurrentUser,
  createGroup,
  createTask,
  updateTask,
  createProject,
  canEditGroup,
  userRoleInGroup,
  deleteTask,
  postChatMessage,
  getChatChannel,
  renderHeader,
  formatTime,
};

// Active link highlighting, mobile nav toggle, and back-to-top button
function enhanceHeaderUX(headerRoot, isPublic) {
  try {
    const path = location.pathname.split("/").pop() || "index.html";
    headerRoot.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href') || '';
      if (href && href.split('#')[0] === path) {
        a.setAttribute('aria-current', 'page');
      }
    });

    const toggle = headerRoot.querySelector('.nav-toggle');
    const nav = headerRoot.querySelector('.nav-public');
    if (toggle && nav) {
      toggle.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        nav.setAttribute('data-open', expanded ? 'false' : 'true');
      });
      // Ensure nav is visible by default on small screens
      if (window.innerWidth <= 720) {
        toggle.setAttribute('aria-expanded', 'true');
        nav.setAttribute('data-open', 'true');
      }
    }
  } catch (_) {}
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    const btn = document.createElement('button');
    btn.className = 'back-to-top';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Back to top');
    btn.textContent = '↑';
    btn.style.display = 'none';
    document.body.appendChild(btn);
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    window.addEventListener('scroll', () => {
      const show = window.scrollY > 300;
      btn.style.display = show ? 'grid' : 'none';
    });
  } catch (_) {}
});
