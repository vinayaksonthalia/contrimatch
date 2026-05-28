/**
 * ContriMatch — Frontend Application (Upgraded v11.0)
 * Connects to FastAPI backend (port 8000) and renders Coral SQL results.
 */

const API = "http://localhost:8000/api";

let currentAskResults = null;
let showRawJson = false;
let loadedNews = [];
let loadedArticles = [];
let remotiveJobsCount = 0;
let adzunaJobsCount = 0;

function updateJobsStat() {
  const el = document.getElementById("stat-jobs");
  if (el) {
    el.textContent = remotiveJobsCount + adzunaJobsCount;
  }
}

// Global scope track map to protect against interval layering
const activeTimelines = {};

// ─── Native Telegram Brokers ──────────────────────────────────────────
async function sendToTelegram(event, type, title, url, subtitle) {
  event.stopPropagation();
  event.preventDefault();
  try {
    const res = await fetch(`${API}/telegram/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, title, url, subtitle })
    });
    if (res.ok) alert("✈️ Record dispatched to Telegram Bot channel!");
    else {
      const err = await res.json();
      alert(`⚠️ Hold: ${err.detail}`);
    }
  } catch (e) { alert(`Error: ${e.message}`); }
}

async function sendDigest() {
  toggleElementLoading("digest-btn", true);
  try {
    const res = await fetch(`${API}/telegram/digest`);
    if (res.ok) alert("🚀 Dynamic summary digest dispatched directly to Telegram!");
    else alert("⚠️ Could not compile active update frames.");
  } catch (e) { alert(`Error: ${e.message}`); }
  finally { toggleElementLoading("digest-btn", false); }
}

// ─── Live Adzuna Integration Panel ───────────────────────────────────
async function loadAdzuna() {
  const el = document.getElementById("adzuna-body");
  const keyword = document.getElementById("adzuna-query-input")?.value.trim() || "";
  const location = document.getElementById("adzuna-location-input")?.value.trim() || "";
  const jobType = document.getElementById("adzuna-type-input")?.value.trim() || "";

  // Concatenate cleanly handling spacing and trimming
  const what = `${keyword} ${location} ${jobType}`.trim() || "developer";

  startPanelTimeline("adzuna-body", ["💼 Initializing Adzuna lookup criteria...", "🌐 Polling global category indices..."]);
  try {
    const res = await fetch(`${API}/adzuna?what=${encodeURIComponent(what)}`);
    const json = await res.json();
    const data = json.data || [];
    adzunaJobsCount = data.length;
    updateJobsStat();
    stopPanelTimeline("adzuna-body");

    if (!data.length) { el.innerHTML = getEmptyStateHTML("No Openings Found", "Try altering search terms or location."); return; }
    el.innerHTML = data.map(d => `
      <div class="data-row">
        <div class="row-title" style="display:flex; justify-content:space-between; align-items:center;">
          <a href="${esc(d.url)}" target="_blank">💼 ${esc(d.title)}</a>
          <button class="btn btn-sm" style="padding:2px 6px; font-size:10px;" onclick="sendToTelegram(event, 'Adzuna Position', '${esc(d.title)}', '${esc(d.url)}', '${esc(d.company)}')">✈️ Send</button>
        </div>
        <div class="row-meta"><span>🏢 ${esc(d.company)}</span><span>📍 ${esc(d.location)}</span></div>
      </div>
    `).join("");
  } catch (err) { stopPanelTimeline("adzuna-body"); el.innerHTML = `<div class="error-msg">${esc(err.message)}</div>`; }
}
function reloadAdzuna() { loadAdzuna(); }

function resetAdzunaFilters() {
  const query = document.getElementById("adzuna-query-input");
  const loc = document.getElementById("adzuna-location-input");
  const type = document.getElementById("adzuna-type-input");
  if (query) query.value = "developer";
  if (loc) loc.value = "";
  if (type) type.value = "";
  loadAdzuna();
}


// ─── Utility: safe HTML escape ─────────────────────────────────────
function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Utility: relative time ────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Utility: truncate text ────────────────────────────────────────
function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? str.substring(0, max) + "…" : str;
}

// ─── Utility: render tag pills ─────────────────────────────────────
function renderTags(tagStr, max) {
  if (!tagStr) return "";
  const tags = tagStr.split(",").map((t) => t.trim()).filter(Boolean).slice(0, max || 5);
  return (
    '<div class="tag-list">' +
    tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("") +
    "</div>"
  );
}

// ─── Utility: Button Loading State Toggle ─────────────────────────
function toggleElementLoading(buttonId, isLoading) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.disabled = isLoading;
  if (isLoading) {
    btn.classList.add('loading');
  } else {
    btn.classList.remove('loading');
  }
}

// ─── Utility: Timeline Loading State Rotation ──────────────────────
function startPanelTimeline(elementId, customPipelines) {
  const container = document.getElementById(elementId);
  if (!container) return;

  // Clear any existing active timer running on this specific node
  if (activeTimelines[elementId]) {
    clearInterval(activeTimelines[elementId]);
  }

  const pipelines = customPipelines || [
    "📡 Initializing local Coral database workspace...",
    "🐙 Synchronizing upstream GitHub project schemas...",
    "💼 Mapping remote career parameters via Remotive API...",
    "🧬 Resolving cross-source data constraints..."
  ];
  
  let index = 0;
  container.innerHTML = `<div class="loading"><div class="spinner"></div> ${pipelines[0]}</div>`;

  activeTimelines[elementId] = setInterval(() => {
    index++;
    const loader = container.querySelector(".loading");
    if (loader) {
      loader.innerHTML = `<div class="spinner"></div> ${pipelines[index % pipelines.length]}`;
    }
  }, 1200);
}

function stopPanelTimeline(elementId) {
  if (activeTimelines[elementId]) {
    clearInterval(activeTimelines[elementId]);
    delete activeTimelines[elementId];
  }
}

// ─── Utility: High-Fidelity Empty State Box ────────────────────────
function getEmptyStateHTML(title = "No Matching Data Nodes Found", desc = "The sources compiled successfully, but no active records exist for this contextual filter.") {
  return `
    <div class="empty-state-box" style="text-align: center; padding: 40px 20px; border: 1px dashed var(--border); border-radius: var(--radius); margin: 10px 0;">
      <div style="font-size: 26px; margin-bottom: 10px;">🏝️</div>
      <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${esc(title)}</div>
      <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px; line-height: 1.4;">${esc(desc)}</div>
    </div>
  `;
}

// ─── Utility: Theme Toggle ─────────────────────────────────────────
function toggleTheme() {
  const body = document.body;
  const btn = document.getElementById("theme-btn");
  const isLight = body.classList.toggle("light-theme");
  
  if (isLight) {
    btn.textContent = "🌙 Dark";
    localStorage.setItem("theme", "light");
  } else {
    btn.textContent = "☀️ Light";
    localStorage.setItem("theme", "dark");
  }
}

// ─── Load: Issues (GitHub) ─────────────────────────────────────────
// ─── Live Dynamic Multi-Repo OSS Issues ─────────────────────────────
let issueRepos = JSON.parse(localStorage.getItem("issueRepos")) || ["withcoral/coral"];

function saveIssueRepos() {
  localStorage.setItem("issueRepos", JSON.stringify(issueRepos));
}

function renderRepoBadges() {
  const activeBox = document.getElementById("issues-active-repos");
  if (!activeBox) return;
  activeBox.innerHTML = issueRepos.map(r => `
    <span class="source-badge" style="border-color: var(--accent-light); padding: 2px 8px; font-size: 10px; display: inline-flex; align-items: center; gap: 6px; background: var(--bg-elevated);">
      ${esc(r)}
      <span onclick="deleteIssueRepo('${esc(r)}')" style="cursor: pointer; font-weight: bold; color: var(--pink); margin-left: 4px; font-size: 12px;">×</span>
    </span>
  `).join("");
}

function addIssueRepo() {
  const input = document.getElementById("issues-new-repo-input");
  if (!input) return;
  const val = input.value.trim();
  if (!val) return;
  if (!val.includes("/")) {
    alert("Please enter repository in owner/repo format (e.g. facebook/react).");
    return;
  }
  if (!issueRepos.includes(val)) {
    issueRepos.push(val);
    saveIssueRepos();
    input.value = "";
    loadIssues();
  }
}

function deleteIssueRepo(val) {
  issueRepos = issueRepos.filter(r => r !== val);
  if (issueRepos.length === 0) issueRepos = ["withcoral/coral"];
  saveIssueRepos();
  loadIssues();
}

let repoCollapsedStates = {};

function toggleRepoIssueSection(id) {
  const el = document.getElementById(id);
  const arrow = document.getElementById(id + "-arrow");
  if (!el) return;
  const isHidden = el.style.display === "none";
  el.style.display = isHidden ? "block" : "none";
  if (arrow) arrow.textContent = isHidden ? "▼" : "▶";
  repoCollapsedStates[id] = !isHidden; // True if collapsed (was visible, now hidden)
}

function suggestMatch(owner, repo, title) {
  document.getElementById("match-owner").value = owner;
  document.getElementById("match-repo").value = repo;
  
  let tech = "react"; // Default fallback
  const t = title.toLowerCase();
  if (t.includes("python") || t.includes("fastapi")) tech = "python";
  else if (t.includes("typescript") || t.includes("ts")) tech = "typescript";
  else if (t.includes("javascript") || t.includes("js")) tech = "javascript";
  else if (t.includes("supabase")) tech = "supabase";
  else if (t.includes("telegram")) tech = "telegram";
  else if (t.includes("adzuna")) tech = "adzuna";
  else if (t.includes("remotive")) tech = "remotive";
  else if (t.includes("hn") || t.includes("hackernews")) tech = "hackernews";
  else if (t.includes("devto")) tech = "devto";
  
  document.getElementById("match-tech").value = tech;
  loadMatches();
  
  // Smooth scroll
  document.getElementById("match-card")?.scrollIntoView({ behavior: 'smooth' });
}

async function loadIssues() {
  const el = document.getElementById("issues-body");
  if (!el) return;
  
  renderRepoBadges();
  
  startPanelTimeline("issues-body", [
    "🐙 Polling upstream GitHub REST endpoints...",
    "🔑 Validating project access parameters...",
    "📦 Unpacking repository issue nodes...",
    "✅ Filtering out PR collisions..."
  ]);

  let totalIssuesCount = 0;
  let html = "";
  
  try {
    for (const item of issueRepos) {
      const [owner, repo] = item.split("/");
      const repoId = `repo-section-${owner}-${repo}`.replace(/\./g, "-").replace(/\//g, "-");
      
      const res = await fetch(`${API}/issues?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`);
      const json = await res.json();
      const data = json.data || [];
      totalIssuesCount += data.length;
      
      const isCollapsed = repoCollapsedStates[repoId] === true;
      const displayStyle = isCollapsed ? "none" : "block";
      const arrowChar = isCollapsed ? "▶" : "▼";
      
      html += `
        <div class="repo-issue-section" style="margin-bottom: 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; background: var(--bg-card);">
          <div class="repo-issue-header" onclick="toggleRepoIssueSection('${repoId}')" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; padding: 10px 14px; background: var(--bg-elevated); border-bottom: 1px solid var(--border);">
            <span style="font-weight:600; font-size:12px; color: var(--text-primary);">📂 ${esc(owner)}/${esc(repo)}</span>
            <div style="display:flex; align-items:center; gap: 8px;">
              <span class="org-badge" style="font-size: 9px; padding: 2px 6px; background: var(--accent-glow); color: var(--accent-light); border-radius: 12px; border: 1px solid rgba(124, 108, 240, 0.2); font-weight: 600;">${data.length} issues</span>
              <span class="repo-issue-arrow" id="${repoId}-arrow" style="font-size: 10px; color: var(--text-secondary); transition: transform 0.2s;">${arrowChar}</span>
            </div>
          </div>
          <div class="repo-issue-body" id="${repoId}" style="display:${displayStyle}; padding: 10px;">
            ${data.length === 0 ? `<div style="font-size: 11px; color: var(--text-muted); text-align: center; padding: 12px;">🏝️ No unassigned open issues found.</div>` : 
              data.map(d => `
                <div class="data-row" onclick="suggestMatch('${esc(owner)}', '${esc(repo)}', '${esc(d.title)}')" style="cursor: pointer; border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-bottom: 8px; transition: background 0.2s;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='none'">
                  <div class="row-title" style="display:flex; justify-content:space-between; align-items:center; gap: 10px;">
                    <a href="${esc(d.html_url)}" target="_blank" onclick="event.stopPropagation();" style="font-size: 12px; font-weight: 500;">${esc(d.title)}</a>
                    <button class="btn btn-sm" style="padding:2px 6px; font-size:10px; flex-shrink: 0;" onclick="event.stopPropagation(); sendToTelegram(event, 'GitHub Bug', '${esc(d.title)}', '${esc(d.html_url)}', '#${d.number || ''}')">✈️ Send</button>
                  </div>
                  <div class="row-meta" style="margin-top: 4px;">
                    <span>👤 ${esc(d.user__login || d.user_login)}</span>
                    <span>💬 ${d.comments || 0}</span>
                    <span>🕐 ${timeAgo(d.created_at)}</span>
                    <span>#${d.number || ""}</span>
                    ${d.quality_score !== undefined ? `<span class="quality-badge" style="background: ${d.quality_score >= 80 ? 'rgba(74, 222, 128, 0.12)' : 'rgba(240, 150, 92, 0.12)'}; color: ${d.quality_score >= 80 ? 'var(--green)' : 'var(--orange)'}; font-weight: 700; padding: 1px 5px; border-radius: 4px; font-size: 9px; border: 1px solid ${d.quality_score >= 80 ? 'var(--green)40' : 'var(--orange)40'}">🎯 ${d.quality_score}% Match</span>` : ''}
                  </div>
                </div>
              `).join("")
            }
          </div>
        </div>
      `;
    }
    
    stopPanelTimeline("issues-body");
    el.innerHTML = html;
    document.getElementById("stat-issues").textContent = totalIssuesCount;
    
  } catch (err) {
    stopPanelTimeline("issues-body");
    el.innerHTML = `<div class="error-msg">Failed to load issues: ${esc(err.message)}</div>`;
  }
}

async function reloadIssues() {
  loadIssues();
}

// ─── Load: Workspace (GitHub Pulls) ────────────────────────────────
async function loadWorkspace() {
  const el = document.getElementById("workspace-body");
  const user = document.getElementById("workspace-user-input").value.trim() || "vinayaksonthalia";

  startPanelTimeline("workspace-body", [
    "🐙 Fetching active pull requests...",
    "👤 Filtering on user_login context...",
    "📂 Verifying check status and reviews...",
    "✨ Compiling personal contribution stats..."
  ]);

  try {
    const res = await fetch(`${API}/workspace?user=${encodeURIComponent(user)}`);
    const json = await res.json();
    const data = json.data || [];
    currentPrsForTips = data;

    stopPanelTimeline("workspace-body");

    if (!data.length) {
      el.innerHTML = getEmptyStateHTML("No Workspace Branches", `No pull requests found for developer '${user}'.`);
      return;
    }

    el.innerHTML = data
      .map(
        (d) => {
          let stateColor = d.state === 'closed' || d.state === 'merged' ? 'var(--teal)' : 'var(--blue)';
          let statusIcon = d.state === 'closed' || d.state === 'merged' ? '✅' : '⚡';
          
          return `
          <div class="data-row" style="border-left: 3px solid ${stateColor}; padding-left: 10px; margin-bottom: 6px; background: var(--glass);">
            <div class="row-title" style="display:flex; justify-content:space-between; align-items:center;">
              <a href="${esc(d.html_url)}" target="_blank">${statusIcon} ${esc(d.title)}</a>
              <button class="btn btn-sm" style="padding:2px 6px; font-size:10px;" onclick="sendToTelegram(event, 'Pull Request', '${esc(d.title)}', '${esc(d.html_url)}', '#${d.number || ''}')">✈️ Send</button>
            </div>
            <div class="row-meta">
              <span>#${d.number || ""}</span>
              <span style="text-transform: uppercase; font-weight:700; color: ${stateColor}; font-size: 10px;">${esc(d.state)}</span>
              <span>🕐 ${timeAgo(d.created_at)}</span>
            </div>
          </div>`;
        }
      )
      .join("");

  } catch (err) {
    stopPanelTimeline("workspace-body");
    el.innerHTML = `<div class="error-msg">Failed to sync workspace: ${esc(err.message)}</div>`;
  }
}

async function reloadWorkspace() {
  loadWorkspace();
}

// ─── Load: Jobs (Remotive) ─────────────────────────────────────────
async function loadJobs() {
  const el = document.getElementById("jobs-body");
  const category = document.getElementById("jobs-category-input").value.trim() || "Software Development";
  const location = document.getElementById("jobs-location-input")?.value.trim() || "";
  const tech = document.getElementById("jobs-tech-input")?.value.trim() || "";
  const type = document.getElementById("jobs-type-input")?.value || "";

  startPanelTimeline("jobs-body", [
    "💼 Mapping remote career parameters...",
    "🌐 Accessing Remotive API stream...",
    "🏷️ Categorizing tags and coordinates...",
    "🔍 Reindexing developer job listings..."
  ]);

  try {
    let url = `${API}/jobs?category=${encodeURIComponent(category)}`;
    if (location) url += `&location=${encodeURIComponent(location)}`;
    if (tech) url += `&tech=${encodeURIComponent(tech)}`;
    if (type) url += `&job_type=${encodeURIComponent(type)}`;

    const res = await fetch(url);
    const json = await res.json();
    const data = json.data || [];
    remotiveJobsCount = data.length;
    updateJobsStat();

    stopPanelTimeline("jobs-body");

    if (!data.length) {
      el.innerHTML = getEmptyStateHTML("No Jobs Found", `No remote listings found under '${category}'.`);
      return;
    }

    el.innerHTML = data
      .map(
        (d) => {
          // Relevance scoring calculations
          const userTech = ["react", "python", "javascript", "fastapi", "telegram", "adzuna", "hn", "devto", "github", "typescript", "node"];
          let score = 50;
          
          if (d.tags) {
            const tagsList = d.tags.toLowerCase().split(",").map(t => t.trim());
            const matches = tagsList.filter(t => userTech.some(ut => t.includes(ut) || ut.includes(t)));
            score += matches.length * 15;
          }
          
          const loc = (d.candidate_required_location || "").toLowerCase();
          if (loc.includes("worldwide") || loc.includes("anywhere") || loc.includes("remote")) {
            score += 20;
          } else if (loc.includes("india") || loc.includes("apac")) {
            score += 15;
          }
          
          const pubDate = d.publication_date ? new Date(d.publication_date).getTime() : 0;
          if (pubDate) {
            const ageDays = (Date.now() - pubDate) / (1000 * 60 * 60 * 24);
            if (ageDays < 3) score += 15;
            else if (ageDays < 7) score += 10;
            else if (ageDays < 14) score += 5;
          }
          
          score = Math.max(0, Math.min(100, Math.round(score)));
          
          let badgeText = "🎯 Match";
          let badgeColor = "var(--text-secondary)";
          if (score >= 80) {
            badgeText = "🎯 High Match";
            badgeColor = "var(--green)";
          } else if (score >= 60) {
            badgeText = "🎯 Good Match";
            badgeColor = "var(--blue)";
          }
          
          return `
          <div class="data-row">
            <div class="row-title" style="display:flex; justify-content:space-between; align-items:center;">
              <a href="${esc(d.url)}" target="_blank">${esc(d.title)}</a>
              <button class="btn btn-sm" style="padding:2px 6px; font-size:10px;" onclick="sendToTelegram(event, 'Remotive Job', '${esc(d.title)}', '${esc(d.url)}', '${esc(d.company_name)}')">✈️ Send</button>
            </div>
            <div class="row-meta">
              <span>🏢 ${esc(d.company_name)}</span>
              <span>📍 ${esc(truncate(d.candidate_required_location, 30))}</span>
              <span>📅 ${timeAgo(d.publication_date)}</span>
              <span class="quality-badge" style="background: var(--glass); color: ${badgeColor}; font-weight: 700; padding: 1px 5px; border-radius: 4px; font-size: 9px; border: 1px solid ${badgeColor}40;">${badgeText} (${score}%)</span>
            </div>
            ${renderTags(d.tags, 6)}
          </div>`;
        }
      )
      .join("");

  } catch (err) {
    stopPanelTimeline("jobs-body");
    el.innerHTML = `<div class="error-msg">Failed to load jobs: ${esc(err.message)}</div>`;
  }
}

function resetJobFilters() {
  const locInput = document.getElementById("jobs-location-input");
  const techInput = document.getElementById("jobs-tech-input");
  const typeInput = document.getElementById("jobs-type-input");
  if (locInput) locInput.value = "";
  if (techInput) techInput.value = "";
  if (typeInput) typeInput.value = "";
  loadJobs();
}

async function reloadJobs() {
  loadJobs();
}

// ─── Load: News (HackerNews) ───────────────────────────────────────
async function loadNews() {
  const el = document.getElementById("news-body");
  const topic = document.getElementById("news-topic-input").value.trim() || "open source contributing";

  startPanelTimeline("news-body", [
    "📰 Accessing Algolia HackerNews indexes...",
    "📈 Syncing trending story metadata...",
    "▲ Compiling upvotes and discussion logs..."
  ]);

  try {
    const res = await fetch(`${API}/news?topic=${encodeURIComponent(topic)}`);
    const json = await res.json();
    loadedNews = json.data || [];

    stopPanelTimeline("news-body");
    renderNewsList();
  } catch (err) {
    stopPanelTimeline("news-body");
    el.innerHTML = `<div class="error-msg">Failed to load news: ${esc(err.message)}</div>`;
  }
}

function renderNewsList() {
  const el = document.getElementById("news-body");
  if (!el) return;
  const sort = document.getElementById("news-sort-input")?.value || "points";

  let data = [...loadedNews];
  if (sort === "points") {
    data.sort((a, b) => (b.points || 0) - (a.points || 0));
  } else if (sort === "date") {
    data.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }

  if (!data.length) {
    el.innerHTML = getEmptyStateHTML("No Stories Found", "Try altering topic tags.");
    return;
  }

  el.innerHTML = data
    .map(
      (d) => `
    <div class="data-row">
      <div class="row-title" style="display:flex; justify-content:space-between; align-items:center;">
        <a href="${esc(d.url)}" target="_blank">${esc(d.title)}</a>
        <button class="btn btn-sm" style="padding:2px 6px; font-size:10px;" onclick="sendToTelegram(event, 'HackerNews Story', '${esc(d.title)}', '${esc(d.url)}', 'author: ${esc(d.author)}')">✈️ Send</button>
      </div>
      <div class="row-meta">
        <span>▲ ${d.points || 0} pts</span>
        <span>💬 ${d.num_comments || 0}</span>
        <span>👤 ${esc(d.author)}</span>
        ${d.created_at ? `<span>🕐 ${timeAgo(d.created_at)}</span>` : ""}
      </div>
    </div>`
    )
    .join("");
}

async function reloadHN() {
  loadNews();
}

// ─── Load: Articles (DEV.to) ───────────────────────────────────────
async function loadArticles() {
  const el = document.getElementById("articles-body");
  const tag = document.getElementById("articles-tag-input").value.trim() || "opensource";

  startPanelTimeline("articles-body", [
    "📝 Connecting to DEV.to content network...",
    "🔖 Fetching tag-specific developer guides...",
    "❤️ Indexing article reaction metrics..."
  ]);

  try {
    const res = await fetch(`${API}/articles?tag=${encodeURIComponent(tag)}`);
    const json = await res.json();
    loadedArticles = json.data || [];

    stopPanelTimeline("articles-body");
    renderArticlesList();
  } catch (err) {
    stopPanelTimeline("articles-body");
    el.innerHTML = `<div class="error-msg">Failed to load articles: ${esc(err.message)}</div>`;
  }
}

function renderArticlesList() {
  const el = document.getElementById("articles-body");
  if (!el) return;
  const sort = document.getElementById("articles-sort-input")?.value || "reactions";

  let data = [...loadedArticles];
  if (sort === "reactions") {
    data.sort((a, b) => (b.positive_reactions_count || 0) - (a.positive_reactions_count || 0));
  } else if (sort === "comments") {
    data.sort((a, b) => (b.comments_count || 0) - (a.comments_count || 0));
  }

  if (!data.length) {
    el.innerHTML = getEmptyStateHTML("No Articles Found", "Try altering search tag.");
    return;
  }

  el.innerHTML = data
    .map(
      (d) => `
    <div class="data-row">
      <div class="row-title" style="display:flex; justify-content:space-between; align-items:center;">
        <a href="${esc(d.url)}" target="_blank">${esc(d.title)}</a>
        <button class="btn btn-sm" style="padding:2px 6px; font-size:10px;" onclick="sendToTelegram(event, 'Dev Article', '${esc(d.title)}', '${esc(d.url)}', 'author: ${esc(d.author_username)}')">✈️ Send</button>
      </div>
      <div class="row-meta">
        <span>❤️ ${d.positive_reactions_count || 0}</span>
        <span>💬 ${d.comments_count || 0}</span>
        <span>👤 ${esc(d.author_username)}</span>
        <span>📖 ${d.reading_time_minutes || "?"}m read</span>
      </div>
    </div>`
    )
    .join("");
}

async function reloadDevTo() {
  loadArticles();
}

// ─── Load: Cross-Source Match (GitHub × Remotive JOIN) ─────────────
async function loadMatches() {
  const el = document.getElementById("match-body");
  const owner = document.getElementById("match-owner").value.trim() || "facebook";
  const repo = document.getElementById("match-repo").value.trim() || "react";
  const tech = document.getElementById("match-tech").value.trim() || "react";

  toggleElementLoading("match-btn", true);
  startPanelTimeline("match-body", [
    "📡 Initializing local Coral database workspace...",
    "🐙 Polling live upstream GitHub REST endpoints...",
    "💼 Extracting decoupled career schemas from Remotive API...",
    "🧬 Weaving multi-tenant cross-source tables via SQL JOIN...",
    "⚡ Resolving tags and constraints..."
  ]);

  try {
    const res = await fetch(
      `${API}/match?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&tech=${encodeURIComponent(tech)}`
    );
    const json = await res.json();
    const data = json.data || [];

    stopPanelTimeline("match-body");

    if (!data.length) {
      el.innerHTML = getEmptyStateHTML("No Cross-Source Matches Found", "No unassigned issues matched tags on the remote jobs database.");
      return;
    }

    el.innerHTML = data
      .map(
        (d) => `
      <div class="match-row">
        <div class="match-side">
          <div class="side-label">📋 Open Issue</div>
          <div class="side-title"><a href="${esc(d.issue_url || d.issue_link)}" target="_blank">${esc(truncate(d.issue || d.issue_to_solve, 60))}</a></div>
        </div>
        <div class="match-arrow">⟷</div>
        <div class="match-side">
          <div class="side-label">💼 Matching Job</div>
          <div class="side-title"><a href="${esc(d.job_url || d.job_link)}" target="_blank">${esc(truncate(d.job || d.matching_job, 60))}</a></div>
          <div class="side-meta">🏢 ${esc(d.company_name)}</div>
        </div>
      </div>`
      )
      .join("");
  } catch (err) {
    stopPanelTimeline("match-body");
    el.innerHTML = `<div class="error-msg">Failed to load matches: ${esc(err.message)}</div>`;
  } finally {
    toggleElementLoading("match-btn", false);
  }
}

// ─── Load: Cross-Source Trending (HN × DEV.to JOIN) ──────────────────
async function loadTrending() {
  const el = document.getElementById("trending-body");
  const topic = document.getElementById("trending-topic").value.trim() || "javascript";

  toggleElementLoading("trending-btn", true);
  startPanelTimeline("trending-body", [
    "📡 Spinning up Coral query loopback...",
    "📰 Querying Algolia HackerNews database...",
    "📝 Correlating tags on DEV.to content network...",
    "🔥 Compiling multi-source trend matrix..."
  ]);

  try {
    const res = await fetch(`${API}/trending?topic=${encodeURIComponent(topic)}`);
    const json = await res.json();
    const data = json.data || [];

    stopPanelTimeline("trending-body");

    if (!data.length) {
      el.innerHTML = getEmptyStateHTML("No Trending Correlates Found", "No overlap found between trending tech news and development manuals.");
      return;
    }

    el.innerHTML = data
      .map(
        (d) => `
      <div class="match-row">
        <div class="match-side">
          <div class="side-label">🔥 HN Trend</div>
          <div class="side-title"><a href="${esc(d.hn_url || d.trending_url)}" target="_blank">${esc(truncate(d.trending || d.trending_topic, 60))}</a></div>
          <div class="side-meta">▲ ${d.points || 0} pts</div>
        </div>
        <div class="match-arrow">⟷</div>
        <div class="match-side">
          <div class="side-label">📝 DEV.to Article</div>
          <div class="side-title"><a href="${esc(d.article_url || d.article_link)}" target="_blank">${esc(truncate(d.article || d.learn_article, 60))}</a></div>
          <div class="side-meta">❤️ ${d.positive_reactions_count || 0} reactions</div>
        </div>
      </div>`
      )
      .join("");
  } catch (err) {
    stopPanelTimeline("trending-body");
    el.innerHTML = `<div class="error-msg">Failed to load trending: ${esc(err.message)}</div>`;
  } finally {
    toggleElementLoading("trending-btn", false);
  }
}

// ─── Render: Dynamic Rich Cards for NL→SQL Results ─────────────────
function renderDynamicCards(records) {
  if (!records || records.length === 0) {
    return getEmptyStateHTML("No Matching Data Nodes Found", "The sources compiled successfully, but no active records exist for this contextual filter string.");
  }

  return `<div class="cards-grid">` + records.map((row) => {
    // 1. Cross-Source Issue × Job
    if (('issue' in row || 'issue_to_solve' in row) && ('job' in row || 'matching_job' in row)) {
      const issue = row.issue || row.issue_to_solve || '';
      const issueUrl = row.issue_url || row.issue_link || '#';
      const job = row.job || row.matching_job || '';
      const jobUrl = row.job_url || row.job_link || '#';
      const company = row.company_name || '';
      return `
        <div class="match-row" style="margin-bottom: 8px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px;">
          <div class="match-side">
            <div class="side-label">📋 Open Issue</div>
            <div class="side-title" style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
              <a href="${esc(issueUrl)}" target="_blank">${esc(truncate(issue, 45))}</a>
              <button class="btn btn-sm" style="padding:2px 6px; font-size:10px;" onclick="sendToTelegram(event, 'GitHub Bug', '${esc(issue)}', '${esc(issueUrl)}', '')">✈️ Send</button>
            </div>
          </div>
          <div class="match-arrow">⟷</div>
          <div class="match-side">
            <div class="side-label">💼 Matching Job</div>
            <div class="side-title" style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
              <a href="${esc(jobUrl)}" target="_blank">${esc(truncate(job, 45))}</a>
              <button class="btn btn-sm" style="padding:2px 6px; font-size:10px;" onclick="sendToTelegram(event, 'Job Position', '${esc(job)}', '${esc(jobUrl)}', '${esc(company)}')">✈️ Send</button>
            </div>
            <div class="side-meta">🏢 ${esc(company)}</div>
          </div>
        </div>
      `;
    }

    // 2. Cross-Source HN × DEV.to
    if (('trending' in row || 'trending_topic' in row) && ('article' in row || 'learn_article' in row)) {
      const trending = row.trending || row.trending_topic || '';
      const hnUrl = row.hn_url || row.trending_url || row.article_link || '#';
      const article = row.article || row.learn_article || '';
      const articleUrl = row.article_url || row.article_link || '#';
      const points = row.points || row.score || 0;
      const reactions = row.positive_reactions_count || 0;
      return `
        <div class="match-row" style="margin-bottom: 8px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px;">
          <div class="match-side">
            <div class="side-label">🔥 HN Trend</div>
            <div class="side-title" style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
              <a href="${esc(hnUrl)}" target="_blank">${esc(truncate(trending, 45))}</a>
              <button class="btn btn-sm" style="padding:2px 6px; font-size:10px;" onclick="sendToTelegram(event, 'HackerNews Trend', '${esc(trending)}', '${esc(hnUrl)}', '')">✈️ Send</button>
            </div>
            <div class="side-meta">▲ ${points} pts</div>
          </div>
          <div class="match-arrow">⟷</div>
          <div class="match-side">
            <div class="side-label">📝 DEV.to Article</div>
            <div class="side-title" style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
              <a href="${esc(articleUrl)}" target="_blank">${esc(truncate(article, 45))}</a>
              <button class="btn btn-sm" style="padding:2px 6px; font-size:10px;" onclick="sendToTelegram(event, 'Dev Article', '${esc(article)}', '${esc(articleUrl)}', '')">✈️ Send</button>
            </div>
            <div class="side-meta">❤️ ${reactions} reactions</div>
          </div>
        </div>
      `;
    }

    // 3a. Single Remotive Job
    if ('company_name' in row || 'candidate_required_location' in row) {
      const title = row.title || Object.values(row)[0];
      const link = row.url || '#';
      const company = row.company_name || '';
      const location = row.candidate_required_location || '';
      const salary = row.salary || '';
      const tags = row.tags || '';
      return `
        <div class="data-row" style="background: var(--bg-elevated); margin-bottom: 8px; padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); text-align: left;">
          <div class="row-title" style="display:flex; justify-content:space-between; align-items:center;">
            <a href="${esc(link)}" target="_blank">💼 ${esc(title)}</a>
            <button class="btn btn-sm" style="padding:2px 6px; font-size:10px;" onclick="sendToTelegram(event, 'Remotive Job', '${esc(title)}', '${esc(link)}', '${esc(company)}')">✈️ Send</button>
          </div>
          <div class="row-meta">
            ${company ? `<span>🏢 ${esc(company)}</span>` : ''}
            ${location ? `<span>📍 ${esc(location)}</span>` : ''}
            ${salary ? `<span>💰 ${esc(salary)}</span>` : ''}
          </div>
          ${renderTags(tags, 4)}
        </div>
      `;
    }

    // 3b. Single Adzuna Job
    if ('company' in row && 'location' in row && ('salary_max' in row || 'redirect_url' in row || 'url' in row)) {
      const title = row.title || Object.values(row)[0];
      const link = row.url || row.redirect_url || '#';
      const company = row.company || '';
      const location = row.location || '';
      const salary = row.salary_max ? `£${row.salary_max}` : '';
      return `
        <div class="data-row" style="background: var(--bg-elevated); margin-bottom: 8px; padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); text-align: left;">
          <div class="row-title" style="display:flex; justify-content:space-between; align-items:center;">
            <a href="${esc(link)}" target="_blank">💼 ${esc(title)}</a>
            <button class="btn btn-sm" style="padding:2px 6px; font-size:10px;" onclick="sendToTelegram(event, 'Adzuna Job', '${esc(title)}', '${esc(link)}', '${esc(company)}')">✈️ Send</button>
          </div>
          <div class="row-meta">
            ${company ? `<span>🏢 ${esc(company)}</span>` : ''}
            ${location ? `<span>📍 ${esc(location)}</span>` : ''}
            ${salary ? `<span>💰 ${esc(salary)}</span>` : ''}
          </div>
        </div>
      `;
    }

    // 4. Single GitHub Issue or Pull Request
    if ('html_url' in row && ('user__login' in row || 'user_login' in row || 'number' in row)) {
      const title = row.title || Object.values(row)[0];
      const link = row.html_url || '#';
      const user = row.user__login || row.user_login || '';
      const number = row.number || '';
      const state = row.state || '';
      const comments = row.comments || 0;
      return `
        <div class="data-row" style="background: var(--bg-elevated); margin-bottom: 8px; padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); text-align: left;">
          <div class="row-title" style="display:flex; justify-content:space-between; align-items:center;">
            <a href="${esc(link)}" target="_blank">📋 ${esc(title)}</a>
            <button class="btn btn-sm" style="padding:2px 6px; font-size:10px;" onclick="sendToTelegram(event, 'GitHub Record', '${esc(title)}', '${esc(link)}', '#${esc(number)}')">✈️ Send</button>
          </div>
          <div class="row-meta">
            ${user ? `<span>👤 ${esc(user)}</span>` : ''}
            <span>#${esc(number)}</span>
            <span style="color: ${state === 'open' ? 'var(--teal)' : 'var(--pink)'}">${esc(state)}</span>
            <span>💬 ${esc(comments)}</span>
          </div>
        </div>
      `;
    }

    // 5. Single HackerNews search
    if ('points' in row && 'author' in row) {
      const title = row.title || Object.values(row)[0];
      const link = row.url || '#';
      const points = row.points || 0;
      const comments = row.num_comments || 0;
      const author = row.author || '';
      return `
        <div class="data-row" style="background: var(--bg-elevated); margin-bottom: 8px; padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); text-align: left;">
          <div class="row-title" style="display:flex; justify-content:space-between; align-items:center;">
            <a href="${esc(link)}" target="_blank">📰 ${esc(title)}</a>
            <button class="btn btn-sm" style="padding:2px 6px; font-size:10px;" onclick="sendToTelegram(event, 'HackerNews Story', '${esc(title)}', '${esc(link)}', 'author: ${esc(author)}')">✈️ Send</button>
          </div>
          <div class="row-meta">
            <span>▲ ${esc(points)} pts</span>
            <span>💬 ${esc(comments)}</span>
            <span>👤 ${esc(author)}</span>
          </div>
        </div>
      `;
    }

    // 6. Single DEV.to Article
    if ('positive_reactions_count' in row && 'author_username' in row) {
      const title = row.title || Object.values(row)[0];
      const link = row.url || '#';
      const reactions = row.positive_reactions_count || 0;
      const author = row.author_username || '';
      const readingTime = row.reading_time_minutes || '';
      return `
        <div class="data-row" style="background: var(--bg-elevated); margin-bottom: 8px; padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); text-align: left;">
          <div class="row-title" style="display:flex; justify-content:space-between; align-items:center;">
            <a href="${esc(link)}" target="_blank">📝 ${esc(title)}</a>
            <button class="btn btn-sm" style="padding:2px 6px; font-size:10px;" onclick="sendToTelegram(event, 'Dev Article', '${esc(title)}', '${esc(link)}', 'author: ${esc(author)}')">✈️ Send</button>
          </div>
          <div class="row-meta">
            <span>❤️ ${esc(reactions)}</span>
            <span>👤 ${esc(author)}</span>
            ${readingTime ? `<span>📖 ${esc(readingTime)}m read</span>` : ''}
          </div>
        </div>
      `;
    }

    // 7. General Reflective Fallback (Vulnerability mitigation)
    const keys = Object.keys(row);
    if (keys.length === 0) return '';

    const titleKey = keys.find(k => k.toLowerCase().includes('title') || k.toLowerCase().includes('name') || k.toLowerCase().includes('trending') || k.toLowerCase().includes('issue') || k.toLowerCase().includes('job')) || keys[0];
    const linkKey = keys.find(k => k.toLowerCase().includes('url') || k.toLowerCase().includes('link') || k.toLowerCase().includes('html'));

    const title = row[titleKey] || 'Record';
    const link = linkKey ? row[linkKey] : '#';

    const metaParts = keys
      .filter(k => k !== titleKey && k !== linkKey)
      .map(k => `<span><strong>${esc(k)}:</strong> ${esc(truncate(String(row[k]), 40))}</span>`)
      .join(' · ');

    return `
      <div class="data-row" style="background: var(--bg-elevated); margin-bottom: 8px; padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); text-align: left;">
        <div class="row-title" style="display:flex; justify-content:space-between; align-items:center;">
          ${linkKey ? `<a href="${esc(link)}" target="_blank">🔍 ${esc(title)}</a>` : `🔍 ${esc(title)}`}
          <button class="btn btn-sm" style="padding:2px 6px; font-size:10px;" onclick="sendToTelegram(event, 'Query Result', '${esc(title)}', '${esc(link)}', '')">✈️ Send</button>
        </div>
        ${metaParts ? `<div class="row-meta" style="flex-wrap: wrap; gap: 8px; margin-top: 4px;">${metaParts}</div>` : ''}
      </div>
    `;
  }).join("") + `</div>`;
}


// ─── Render: Ask Agent Output with Toggles ───────────────────────────
function renderAskResults() {
  const wrapper = document.getElementById("ask-data-wrapper");
  if (!currentAskResults) return;

  if (showRawJson) {
    wrapper.innerHTML = `
      <div style="padding: 10px; display: flex; justify-content: flex-end; border-bottom: 1px solid var(--border);">
        <button class="btn btn-sm" id="json-toggle-btn" onclick="toggleRawJson()">Show Cards</button>
      </div>
      <pre style="padding: 12px; font-family: var(--font-mono); font-size: 11px; color: var(--text-primary); background: transparent; border: none; overflow-x: auto; white-space: pre-wrap; margin: 0; text-align: left;">${esc(JSON.stringify(currentAskResults, null, 2))}</pre>
    `;
  } else {
    wrapper.innerHTML = `
      <div style="padding: 10px; display: flex; justify-content: flex-end; border-bottom: 1px solid var(--border);">
        <button class="btn btn-sm" id="json-toggle-btn" onclick="toggleRawJson()">Show Raw JSON</button>
      </div>
      <div style="padding: 12px; width: 100%;">
        ${renderDynamicCards(currentAskResults)}
      </div>
    `;
  }
}

function toggleRawJson() {
  showRawJson = !showRawJson;
  renderAskResults();
}

// ─── Ask ContriMatch (NL→SQL) ──────────────────────────────────────
async function askAgent() {
  const input = document.getElementById("ask-input");
  const question = input.value.trim();
  if (!question) return;

  const resultDiv = document.getElementById("ask-result");
  const sqlEl = document.getElementById("ask-sql");
  const countEl = document.getElementById("ask-count");

  resultDiv.classList.add("active");
  sqlEl.textContent = "-- 🤖 Thinking... Converting to Coral SQL...";
  sqlEl.style.color = "";
  countEl.textContent = "…";
  
  toggleElementLoading("ask-btn", true);
  startPanelTimeline("ask-data-wrapper", [
    "🤖 Parsing user natural language prompt...",
    "🧠 Querying Gemini model for SQL compilation...",
    "🔍 Validating generated Coral SQL query structure...",
    "📡 Launching sub-process loop to local Coral engine...",
    "🧬 Weaving cross-source datasets dynamically..."
  ]);

  try {
    const res = await fetch(`${API}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const json = await res.json();

    stopPanelTimeline("ask-data-wrapper");

    // Show generated SQL
    if (json.sql) {
      sqlEl.textContent = json.sql;
    }

    // Show error if any
    if (json.error) {
      document.getElementById("ask-data-wrapper").innerHTML = `<div class="error-msg">Error: ${esc(json.error)}</div>`;
      countEl.textContent = "error";
      return;
    }

    // Show results
    currentAskResults = json.data || [];
    countEl.textContent = currentAskResults.length;
    renderAskResults();
  } catch (err) {
    stopPanelTimeline("ask-data-wrapper");
    sqlEl.textContent = "-- Failed to reach backend";
    sqlEl.style.color = "var(--pink)";
    document.getElementById("ask-data-wrapper").innerHTML = `<div class="error-msg">Failed to execute: ${esc(err.message)}</div>`;
    countEl.textContent = "error";
  } finally {
    toggleElementLoading("ask-btn", false);
  }
}

function askPreset(question) {
  document.getElementById("ask-input").value = question;
  askAgent();
}

// ─── Health check ──────────────────────────────────────────────────
async function checkHealth() {
  const el = document.getElementById("stat-api");
  try {
    const res = await fetch(`${API}/health`);
    if (res.ok) {
      el.textContent = "✓";
      el.style.color = "var(--teal)";
    } else {
      el.textContent = "✗";
      el.style.color = "var(--pink)";
    }
  } catch {
    el.textContent = "✗";
    el.style.color = "var(--pink)";
  }
}

// ─── Settings Manager Logic ──────────────────────────────────────────
let settingsPassword = "";

async function openSettings() {
  const modal = document.getElementById("settings-modal");
  modal.classList.add("active");
  
  // Check settings status (if password is set)
  try {
    const res = await fetch(`${API}/settings/status`);
    const json = await res.json();
    
    document.getElementById("settings-setup-step").style.display = "none";
    document.getElementById("settings-unlock-step").style.display = "none";
    document.getElementById("settings-manage-step").style.display = "none";
    
    if (json.setup) {
      if (settingsPassword) {
        // Already unlocked in session
        loadManageKeysStep();
      } else {
        document.getElementById("settings-unlock-step").style.display = "block";
        document.getElementById("unlock-password-input").focus();
      }
    } else {
      document.getElementById("settings-setup-step").style.display = "block";
      document.getElementById("setup-password-input").focus();
    }
  } catch (e) {
    alert("Error fetching settings status: " + e.message);
  }
}

function closeSettings() {
  document.getElementById("settings-modal").classList.remove("active");
}

async function setupPassword() {
  const pwd = document.getElementById("setup-password-input").value;
  if (!pwd) {
    alert("Please enter a master password.");
    return;
  }
  try {
    const res = await fetch(`${API}/settings/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pwd })
    });
    if (res.ok) {
      settingsPassword = pwd;
      alert("Master password set successfully! Unlocking key manager...");
      loadManageKeysStep();
    } else {
      const err = await res.json();
      alert("Failed: " + err.detail);
    }
  } catch (e) {
    alert("Error: " + e.message);
  }
}

async function unlockSettings() {
  const pwd = document.getElementById("unlock-password-input").value;
  if (!pwd) {
    alert("Please enter password.");
    return;
  }
  try {
    const res = await fetch(`${API}/settings/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pwd })
    });
    if (res.ok) {
      settingsPassword = pwd;
      document.getElementById("unlock-password-input").value = "";
      loadManageKeysStep();
    } else {
      alert("Wrong password.");
    }
  } catch (e) {
    alert("Error verifying password: " + e.message);
  }
}

async function loadManageKeysStep() {
  document.getElementById("settings-unlock-step").style.display = "none";
  document.getElementById("settings-setup-step").style.display = "none";
  document.getElementById("settings-manage-step").style.display = "block";
  
  // Load current keys
  try {
    const res = await fetch(`${API}/settings/keys/get`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: settingsPassword })
    });
    if (res.ok) {
      const json = await res.json();
      const keys = json.keys || {};
      document.getElementById("key-github-input").value = keys.GITHUB_TOKEN || "";
      document.getElementById("key-gemini-input").value = keys.GEMINI_API_KEY || "";
      document.getElementById("key-telegram-input").value = keys.TELEGRAM_BOT_TOKEN || "";
      document.getElementById("key-model-input").value = keys.GEMINI_MODEL || "gemini-3.5-flash";
    } else {
      alert("Failed to load keys. Please verify password.");
    }
  } catch (e) {
    alert("Error loading keys: " + e.message);
  }
}

async function saveKeys() {
  const github = document.getElementById("key-github-input").value;
  const gemini = document.getElementById("key-gemini-input").value;
  const telegram = document.getElementById("key-telegram-input").value;
  const model = document.getElementById("key-model-input").value;
  
  toggleElementLoading("save-keys-btn", true);
  try {
    const res = await fetch(`${API}/settings/keys/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: settingsPassword,
        keys: {
          GITHUB_TOKEN: github,
          GEMINI_API_KEY: gemini,
          TELEGRAM_BOT_TOKEN: telegram,
          GEMINI_MODEL: model
        }
      })
    });
    if (res.ok) {
      alert("API keys saved and hot-reloaded! Environment updated successfully.");
      closeSettings();
      // Reload panels to refresh with new credentials
      checkHealth();
      loadIssues();
      loadWorkspace();
      loadJobs();
      loadAdzuna();
    } else {
      const err = await res.json();
      alert("Failed to save keys: " + err.detail);
    }
  } catch (e) {
    alert("Error saving keys: " + e.message);
  } finally {
    toggleElementLoading("save-keys-btn", false);
  }
}

async function changePassword() {
  const newPwd = document.getElementById("change-new-password").value;
  if (!newPwd) {
    alert("Please enter a new password.");
    return;
  }
  try {
    const res = await fetch(`${API}/settings/change_password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_password: settingsPassword,
        new_password: newPwd
      })
    });
    if (res.ok) {
      settingsPassword = newPwd;
      document.getElementById("change-new-password").value = "";
      alert("Password changed successfully!");
    } else {
      const err = await res.json();
      alert("Failed to change password: " + err.detail);
    }
  } catch (e) {
    alert("Error changing password: " + e.message);
  }
}

async function forgotPassword(event) {
  event.preventDefault();
  if (!confirm("Initiate settings password recovery? This will reset your password and send a new temporary password directly to your Telegram bot.")) {
    return;
  }
  try {
    const res = await fetch(`${API}/settings/forgot_password`, {
      method: "POST"
    });
    if (res.ok) {
      alert("🔑 Security recovery complete! Check your phone for a new temporary settings password from your Telegram bot.");
      openSettings(); // refresh status
    } else {
      const err = await res.json();
      alert("Recovery failed: " + err.detail);
    }
  } catch (e) {
    alert("Error recovering password: " + e.message);
  }
}

// ─── Live Dynamic Contributions Grid & Org Grouping ──────────────────
let loadedContributions = [];

async function loadContributions() {
  const el = document.getElementById("contributions-wrapper");
  if (!el) return;

  const user = document.getElementById("workspace-user-input")?.value.trim() || "vinayaksonthalia";
  document.getElementById("contribution-user-label").textContent = user;

  el.innerHTML = `<div class="loading"><div class="spinner"></div> Fetching all pull requests by ${esc(user)}…</div>`;

  try {
    const res = await fetch(`${API}/contributions?user=${encodeURIComponent(user)}`);
    const json = await res.json();
    loadedContributions = json.data || [];

    if (!loadedContributions.length) {
      el.innerHTML = getEmptyStateHTML("No Contributions Located", "Verify GitHub PAT permissions and username.");
      return;
    }

    filterContributions();
  } catch (e) {
    el.innerHTML = `<div class="error-msg">Failed to load contributions: ${esc(e.message)}</div>`;
  }
}

function filterContributions() {
  const org = document.getElementById("contrib-org-filter")?.value.trim().toLowerCase() || "";
  const sort = document.getElementById("contrib-sort-filter")?.value || "all";
  
  let data = [...loadedContributions];
  
  if (org) {
    data = data.filter(pr => `${pr.owner}/${pr.repo}`.toLowerCase().includes(org));
  }
  
  if (sort !== "all") {
    data = data.filter(pr => pr.state === sort);
  }
  
  renderContributionsList(data);
}

function renderContributionsList(data) {
  const el = document.getElementById("contributions-wrapper");
  if (!el) return;
  
  if (!data.length) {
    el.innerHTML = getEmptyStateHTML("No Contributions Match", "Try adjusting your search query or sorting options.");
    return;
  }
  
  const groups = {};
  data.forEach((pr) => {
    const key = `${pr.owner}/${pr.repo}`;
    if (!groups[key]) {
      groups[key] = { owner: pr.owner, repo: pr.repo, open: [], merged: [], closed: [] };
    }
    if (pr.state === "merged") {
      groups[key].merged.push(pr);
    } else if (pr.state === "open") {
      groups[key].open.push(pr);
    } else {
      groups[key].closed.push(pr);
    }
  });

  const sortedKeys = Object.keys(groups).sort((a, b) => {
    const countA = groups[a].open.length + groups[a].merged.length + groups[a].closed.length;
    const countB = groups[b].open.length + groups[b].merged.length + groups[b].closed.length;
    return countB - countA;
  });

  el.innerHTML = sortedKeys.map((key) => {
    const g = groups[key];
    const total = g.open.length + g.merged.length + g.closed.length;
    const id = "org-group-" + key.replace("/", "-");
    
    return `
      <div class="org-group">
        <div class="org-header" onclick="toggleOrgGroup('${id}')">
          <span class="org-name">📂 ${esc(key)}</span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="org-badge">${total} PRs</span>
            <span class="org-arrow" id="${id}-arrow">▶</span>
          </div>
        </div>
        <div class="org-body" id="${id}" style="display: none;">
          ${g.merged.length > 0 ? `
            <div class="pr-subsection">
              <div class="pr-subsection-title">✅ Merged (${g.merged.length})</div>
              <div class="pr-grid">
                ${g.merged.map(pr => `
                  <a href="${esc(pr.html_url)}" target="_blank" class="pr-card pr-merged">
                    <span class="pr-icon">✈️</span>
                    <div class="pr-info">
                      <div class="pr-card-title">${esc(pr.title)}</div>
                      <div class="pr-card-meta">PR #${pr.number} (Merged)</div>
                    </div>
                  </a>
                `).join("")}
              </div>
            </div>
          ` : ""}
          
          ${g.open.length > 0 ? `
            <div class="pr-subsection">
              <div class="pr-subsection-title">⚡ Open (${g.open.length})</div>
              <div class="pr-grid">
                ${g.open.map(pr => `
                  <a href="${esc(pr.html_url)}" target="_blank" class="pr-card pr-open">
                    <span class="pr-icon">🕒</span>
                    <div class="pr-info">
                      <div class="pr-card-title">${esc(pr.title)}</div>
                      <div class="pr-card-meta">PR #${pr.number} (Active)</div>
                    </div>
                  </a>
                `).join("")}
              </div>
            </div>
          ` : ""}
          
          ${g.closed.length > 0 ? `
            <div class="pr-subsection">
              <div class="pr-subsection-title">🛑 Closed/Unmerged (${g.closed.length})</div>
              <div class="pr-grid">
                ${g.closed.map(pr => `
                  <a href="${esc(pr.html_url)}" target="_blank" class="pr-card pr-closed">
                    <span class="pr-icon">🛑</span>
                    <div class="pr-info">
                      <div class="pr-card-title">${esc(pr.title)}</div>
                      <div class="pr-card-meta">PR #${pr.number} (Closed)</div>
                    </div>
                  </a>
                `).join("")}
              </div>
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }).join("");

  if (sortedKeys.length > 0) {
    const firstId = "org-group-" + sortedKeys[0].replace("/", "-");
    toggleOrgGroup(firstId);
  }
}

function toggleOrgGroup(id) {
  const el = document.getElementById(id);
  const arrow = document.getElementById(id + "-arrow");
  if (!el) return;

  const isCollapsed = el.style.display === "none";
  if (isCollapsed) {
    el.style.display = "block";
    if (arrow) arrow.textContent = "▼";
  } else {
    el.style.display = "none";
    if (arrow) arrow.textContent = "▶";
  }
}

// ─── Initialize ────────────────────────────────────────────────────
let currentPrsForTips = [];

// ─── Help Panel & Chat History ──────────────────────────────────────
function toggleHelpPanel() {
  const panel = document.getElementById("help-panel");
  if (!panel) return;
  const isHidden = panel.style.right === "" || panel.style.right === "-400px";
  panel.style.right = isHidden ? "0" : "-400px";
  if (isHidden) {
    renderHelpChat();
  }
}

function renderHelpChat() {
  const container = document.getElementById("help-chat-messages");
  if (!container) return;
  const history = JSON.parse(localStorage.getItem("helpHistory")) || [];
  
  if (history.length === 0) {
    container.innerHTML = `<div style="color: var(--text-secondary); line-height: 1.4;">Welcome to ContriMatch Help! Click any of the Quick Actions presets above or type a custom question below regarding features, jobs, issues, or career tips. You can also paste your resume text here to analyze missing contributions.</div>`;
    return;
  }
  
  container.innerHTML = history.map(chat => `
    <div class="chat-message user" style="margin-bottom: 8px;">
      <div style="font-weight: 700; color: var(--accent-light);">You:</div>
      <div style="margin-top: 2px; line-height: 1.4; white-space: pre-wrap;">${esc(chat.question)}</div>
    </div>
    <div class="chat-message assistant" style="margin-bottom: 12px; border-left: 2px solid var(--teal); padding-left: 8px; margin-top: 4px;">
      <div style="font-weight: 700; color: var(--teal);">ContriMatch Help:</div>
      <div style="margin-top: 2px; line-height: 1.4; white-space: pre-wrap;">${chat.answer}</div>
    </div>
  `).join("");
  
  // Auto scroll to bottom
  container.scrollTop = container.scrollHeight;
}

function saveHelpChat(question, answer) {
  let history = JSON.parse(localStorage.getItem("helpHistory")) || [];
  history.push({ question, answer });
  if (history.length > 10) {
    history = history.slice(history.length - 10);
  }
  localStorage.setItem("helpHistory", JSON.stringify(history));
  renderHelpChat();
}

function askHelpPreset(presetName) {
  let answer = "";
  if (presetName === "Forgot Password") {
    answer = "Send any message to your Telegram bot first, then click Settings → Forgot Password. A temp password will arrive on Telegram.";
  } else if (presetName === "Push Digest") {
    answer = "Click Push Digest in the top header. Make sure your Telegram bot has received at least one message first.";
  } else if (presetName === "Filter jobs") {
    answer = "Use the Location and Tech Stack inputs in the Remote Jobs panel. Type India for India-specific jobs or React for React roles.";
  } else if (presetName === "How to contribute to OSS") {
    answer = "To contribute to OSS, identify unassigned open issues (e.g. from the 'OSS Issues' card), claim them, write code locally using Coral, open a pull request, and get it reviewed by maintainers.";
  } else if (presetName === "Resume Tips") {
    answer = "To get AI-powered Resume Tips: Paste your resume text in the chat input below and click Send. Gemini will automatically analyze it against your active workspace contributions and suggest bullet points!";
  }
  
  saveHelpChat(presetName, answer);
}

async function sendHelpMessage() {
  const input = document.getElementById("help-chat-input");
  if (!input) return;
  const question = input.value.trim();
  if (!question) return;
  
  input.value = "";
  
  // Append user message immediately for responsiveness
  let history = JSON.parse(localStorage.getItem("helpHistory")) || [];
  const container = document.getElementById("help-chat-messages");
  if (container) {
    // Render current history plus the new question
    const tempHistory = [...history, { question, answer: `<div class="spinner" style="width:12px; height:12px; border-width:2px; display:inline-block; vertical-align:middle; margin-right:4px;"></div> Typing...` }];
    container.innerHTML = tempHistory.map(chat => `
      <div class="chat-message user" style="margin-bottom: 8px;">
        <div style="font-weight: 700; color: var(--accent-light);">You:</div>
        <div style="margin-top: 2px; line-height: 1.4; white-space: pre-wrap;">${esc(chat.question)}</div>
      </div>
      <div class="chat-message assistant" style="margin-bottom: 12px; border-left: 2px solid var(--teal); padding-left: 8px; margin-top: 4px;">
        <div style="font-weight: 700; color: var(--teal);">ContriMatch Help:</div>
        <div style="margin-top: 2px; line-height: 1.4;">${chat.answer}</div>
      </div>
    `).join("");
    container.scrollTop = container.scrollHeight;
  }
  
  toggleElementLoading("help-chat-btn", true);
  
  let answer = "";
  try {
    const isResumeQuery = question.toLowerCase().includes("resume") || question.toLowerCase().includes("analyze") || question.length > 150;
    
    if (isResumeQuery) {
      // Auto route to resume tips
      const res = await fetch(`${API}/resume_tips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prs: currentPrsForTips,
          resume_text: question
        })
      });
      if (res.ok) {
        const json = await res.json();
        const tips = json.tips || [];
        if (tips.length === 0) {
          answer = "Gemini analyzed your text: No missing workspace contributions detected in your resume. It seems fully up to date!";
        } else {
          answer = "Gemini compared your resume with your workspace contributions and recommends adding:<br><br>" + 
                   tips.map(tip => `• ${esc(tip)}`).join("<br><br>");
        }
      } else {
        answer = "I was unable to analyze your resume. Please check your credentials and try again.";
      }
    } else {
      // Send custom question to help assistant
      const res = await fetch(`${API}/help`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history })
      });
      if (res.ok) {
        const json = await res.json();
        answer = esc(json.answer || "No response received.");
      } else {
        answer = "Sorry, I could not reach the Help Assistant API.";
      }
    }
  } catch (e) {
    answer = "Error processing request: " + esc(e.message);
  } finally {
    toggleElementLoading("help-chat-btn", false);
  }
  
  saveHelpChat(question, answer);
}

document.addEventListener("DOMContentLoaded", () => {
  // Apply stored theme if present
  const savedTheme = localStorage.getItem("theme");
  const btn = document.getElementById("theme-btn");
  if (savedTheme === "light") {
    document.body.classList.add("light-theme");
    if (btn) btn.textContent = "🌙 Dark";
  } else {
    if (btn) btn.textContent = "☀️ Light";
  }

  checkHealth();
  loadIssues();
  loadWorkspace();
  loadJobs();
  loadAdzuna();
  loadNews();
  loadArticles();
  loadMatches();
  loadTrending();
  loadContributions();
});

