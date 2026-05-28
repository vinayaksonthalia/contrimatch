"""ContriMatch Backend — Upgraded to support Native Telegram and Adzuna Engines."""
import json
import os
import subprocess
import httpx
import asyncio
import threading
import hashlib
import uuid
import secrets
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from nl_to_sql import nl_to_sql

app = FastAPI(title="ContriMatch API", version="11.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")
ENV_FILE = os.path.join(os.path.dirname(__file__), ".env")

def load_env_file():
    if os.path.exists(ENV_FILE):
        try:
            with open(ENV_FILE, "r") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        v = v.strip().strip("'").strip('"')
                        os.environ[k.strip()] = v
        except Exception as e:
            print(f"Error reading .env: {e}")

# Load env file variables before setting global API credentials
load_env_file()

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")

def reload_keys_in_memory():
    global GEMINI_API_KEY, TELEGRAM_BOT_TOKEN
    load_env_file()
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
    TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")

def hash_password(password: str, salt: str = None) -> tuple[str, str]:
    if not salt:
        salt = uuid.uuid4().hex
    h = hashlib.sha256((password + salt).encode()).hexdigest()
    return h, salt

def verify_password_hash(password: str) -> bool:
    if not os.path.exists(CONFIG_FILE):
        return False
    try:
        with open(CONFIG_FILE, "r") as f:
            config = json.load(f)
        stored_hash = config.get("password_hash")
        salt = config.get("salt")
        if not stored_hash or not salt:
            return False
        h, _ = hash_password(password, salt)
        return h == stored_hash
    except Exception:
        return False

def escape_html(text: str) -> str:
    if not text:
        return ""
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")




# ─── Coral runner ───────────────────────────────────────────────────────
def run_coral(sql: str) -> list:
    """Execute a SQL query via `coral sql` and return parsed JSON rows."""
    env = os.environ.copy()
    env["TELEGRAM_BOT_TOKEN"] = TELEGRAM_BOT_TOKEN
    try:
        r = subprocess.run(
            ["coral", "sql", sql, "--format", "json"],
            capture_output=True,
            text=True,
            timeout=60,
            env=env,
        )
        if r.returncode != 0:
            detail = r.stderr.strip() or "Unknown Coral error"
            raise HTTPException(status_code=500, detail=detail)
        return json.loads(r.stdout) if r.stdout.strip() else []
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Query timed out (60s)")
    except json.JSONDecodeError:
        return []


# ─── Dynamic Telegram Chat Resolution ──────────────────────────────────
def get_latest_chat_id() -> int:
    """Queries Vinayak's native telegram.updates source to parse the last active sender."""
    sql = "SELECT chat_id FROM telegram.updates ORDER BY update_id DESC LIMIT 1"
    rows = run_coral(sql)
    if rows and isinstance(rows, list) and "chat_id" in rows[0]:
        return rows[0]["chat_id"]
    return None



# ─── Health ─────────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {"status": "ok", "service": "contrimatch", "sources": 6}



# ─── Issues (GitHub) ────────────────────────────────────────────────────
@app.get("/api/issues")
def get_issues(owner: str = "withcoral", repo: str = "coral"):
    sql = (
        f"SELECT i.title, i.user__login, i.state, i.created_at, i.html_url, i.comments, i.number "
        f"FROM github.issues i "
        f"WHERE i.owner = '{owner}' AND i.repo = '{repo}' AND i.state = 'open' AND i.assignee__login IS NULL "
        f"AND i.comments < 5 "
        f"AND i.title NOT IN (SELECT p.title FROM github.pulls p WHERE p.owner = '{owner}' AND p.repo = '{repo}' AND p.state = 'open') "
        f"ORDER BY i.created_at DESC LIMIT 15"
    )
    data = run_coral(sql)
    
    from datetime import datetime
    for item in data:
        comments = item.get("comments", 0)
        created_at_str = item.get("created_at", "")
        score = 100 - (comments * 12)
        if created_at_str:
            try:
                created_at = datetime.strptime(created_at_str.split("T")[0], "%Y-%m-%d")
                age_days = (datetime.now() - created_at).days
                score -= min(age_days * 0.5, 20)
            except Exception:
                pass
        item["quality_score"] = max(0, min(100, int(score)))

    return {"source": "github", "query": sql, "data": data}


# ─── Workspace Tracker (GitHub PRs) ─────────────────────────────────────
@app.get("/api/workspace")
def get_workspace(user: str = "vinayaksonthalia"):
    sql = (
        f"SELECT title, state, created_at, html_url, number "
        f"FROM github.pulls "
        f"WHERE owner = 'withcoral' AND repo = 'coral' AND user__login = '{user}' "
        f"ORDER BY created_at DESC LIMIT 5"
    )
    return {"source": "github.pulls", "query": sql, "data": run_coral(sql)}


@app.get("/api/contributions")
async def get_contributions(user: str = "vinayaksonthalia"):
    """Fetch all PRs authored by user across GitHub and group/summarize dynamically."""
    headers = {}
    token = os.environ.get("GITHUB_TOKEN", "")
    if token:
        headers["Authorization"] = f"token {token}"
    headers["Accept"] = "application/vnd.github.v3+json"
    
    url = f"https://api.github.com/search/issues?q=type:pr+author:{user}&per_page=100"
    async with httpx.AsyncClient() as client:
        r = await client.get(url, headers=headers)
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail=f"GitHub API Error: {r.text}")
        data = r.json()
        
    items = data.get("items", [])
    prs = []
    for item in items:
        html_url = item.get("html_url", "")
        parts = html_url.split("/")
        owner = parts[3] if len(parts) > 3 else "unknown"
        repo = parts[4] if len(parts) > 4 else "unknown"
        
        pr_data = item.get("pull_request", {})
        is_merged = pr_data.get("merged_at") is not None
        
        if is_merged:
            state = "merged"
        else:
            state = item.get("state", "closed")
            
        prs.append({
            "title": item.get("title"),
            "number": item.get("number"),
            "state": state,
            "html_url": html_url,
            "owner": owner,
            "repo": repo,
            "created_at": item.get("created_at")
        })
    return {"data": prs}


# ─── Jobs (Remotive) ───────────────────────────────────────────────────
@app.get("/api/jobs")
def get_jobs(search: str = "", category: str = "Software Development"):
    if search:
        sql = (
            f"SELECT title, company_name, url, tags, publication_date, "
            f"candidate_required_location, salary, job_type "
            f"FROM remotive.jobs "
            f"WHERE search = '{search}' LIMIT 15"
        )
    else:
        sql = (
            f"SELECT title, company_name, url, tags, publication_date, "
            f"candidate_required_location, salary, job_type "
            f"FROM remotive.jobs "
            f"WHERE category = '{category}' LIMIT 15"
        )
    return {"source": "remotive", "query": sql, "data": run_coral(sql)}


# ─── Jobs (Adzuna) ─────────────────────────────────────────────────────
@app.get("/api/adzuna")
def get_adzuna(what: str = "developer"):
    """Queries Vinayak's newly upstreamed Adzuna job search table function."""
    sql = f"SELECT title, company, redirect_url AS url, location, salary_max FROM adzuna.search_jobs(what => '{what}') LIMIT 15"
    return {"source": "adzuna", "query": sql, "data": run_coral(sql)}



# ─── Tech News (HackerNews) ────────────────────────────────────────────
@app.get("/api/news")
def get_news(topic: str = "open source contributing"):
    sql = (
        f"SELECT title, url, points, num_comments, author "
        f"FROM hn.search "
        f"WHERE query = '{topic}' LIMIT 10"
    )
    return {"source": "hackernews", "query": sql, "data": run_coral(sql)}


# ─── Dev Articles (DEV.to) ─────────────────────────────────────────────
@app.get("/api/articles")
def get_articles(tag: str = "opensource"):
    sql = (
        f"SELECT title, url, positive_reactions_count, comments_count, "
        f"author_username, reading_time_minutes, description "
        f"FROM devto.articles "
        f"WHERE tag = '{tag}' LIMIT 10"
    )
    return {"source": "devto", "query": sql, "data": run_coral(sql)}


# ─── Cross-Source Match (GitHub × Remotive) ─────────────────────────────
@app.get("/api/match")
def get_matches(owner: str = "facebook", repo: str = "react", tech: str = "react"):
    sql = (
        f"SELECT g.title AS issue, g.html_url AS issue_url, "
        f"r.title AS job, r.company_name, r.url AS job_url, r.tags "
        f"FROM github.issues g "
        f"JOIN remotive.jobs r ON r.tags LIKE '%{tech}%' "
        f"WHERE g.owner = '{owner}' AND g.repo = '{repo}' AND g.state = 'open' "
        f"ORDER BY g.created_at DESC LIMIT 10"
    )
    return {
        "source": f"github × remotive (cross-source JOIN on '{tech}')",
        "query": sql,
        "data": run_coral(sql),
    }


# ─── Cross-Source: News × Articles ─────────────────────────────────────
@app.get("/api/trending")
def get_trending(topic: str = "javascript"):
    sql = (
        f"SELECT h.title AS trending, h.points, h.url AS hn_url, "
        f"d.title AS article, d.url AS article_url, d.positive_reactions_count "
        f"FROM hn.search h "
        f"JOIN devto.articles d ON d.tag = '{topic}' "
        f"WHERE h.query = '{topic} programming' "
        f"ORDER BY h.points DESC LIMIT 8"
    )
    return {
        "source": f"hackernews × devto (cross-source JOIN on '{topic}')",
        "query": sql,
        "data": run_coral(sql),
    }


# ─── Telegram Dispatch Endpoints ──────────────────────────────────────
class TelegramSendRequest(BaseModel):
    type: str
    title: str
    url: str
    subtitle: str


@app.post("/api/telegram/send")
async def send_to_telegram(req: TelegramSendRequest):
    chat_id = get_latest_chat_id()
    if not chat_id:
        raise HTTPException(status_code=400, detail="No active chat stream located. Send /start to your bot channel first.")
    
    html_msg = (
        f"🎯 <b>ContriMatch Agent Alert</b>\n\n"
        f"<b>Type:</b> {escape_html(req.type)}\n"
        f"<b>Asset:</b> {escape_html(req.title)}\n"
        f"<b>Context:</b> {escape_html(req.subtitle)}\n\n"
        f"🔗 <a href='{escape_html(req.url)}'>Inspect Contribution Node</a>"
    )
    async with httpx.AsyncClient() as client:
        tgt = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        await client.post(tgt, json={"chat_id": chat_id, "text": html_msg, "parse_mode": "HTML"})
    return {"status": "success"}


@app.get("/api/telegram/digest")
async def push_digest():
    chat_id = get_latest_chat_id()
    if not chat_id:
        raise HTTPException(status_code=400, detail="Bot alignment inactive. Initialize chat history first.")

    # Fetch top 3 issues
    issues = run_coral("SELECT title, html_url FROM github.issues WHERE owner = 'withcoral' AND repo = 'coral' AND state = 'open' AND assignee__login IS NULL LIMIT 3")
    
    # Fetch top 3 Remotive jobs
    remotive = run_coral("SELECT title, company_name, url FROM remotive.jobs WHERE category = 'Software Development' LIMIT 3")
    
    # Fetch top 3 Adzuna jobs
    adzuna = run_coral("SELECT title, company, redirect_url AS url FROM adzuna.search_jobs(what => 'developer') LIMIT 3")

    digest_msg = "🚀 <b>ContriMatch Dynamic Workspace Digest</b>\n\n"
    
    # 1. GitHub Issues
    digest_msg += "📋 <b>Unassigned OSS Bugs (withcoral/coral):</b>\n"
    if issues:
        for i in issues:
            url = i.get("html_url") or i.get("url") or "#"
            digest_msg += f"• <a href='{escape_html(url)}'>{escape_html(i.get('title'))}</a>\n"
    else:
        digest_msg += "🏝️ No unassigned open issues found.\n"
        
    # 2. Remotive Jobs
    digest_msg += "\n💼 <b>Top Openings on Remotive (Software):</b>\n"
    if remotive:
        for r in remotive:
            url = r.get("url") or "#"
            digest_msg += f"• <a href='{escape_html(url)}'>{escape_html(r.get('title'))}</a> at <i>{escape_html(r.get('company_name'))}</i>\n"
    else:
        digest_msg += "🏝️ No Remotive listings found.\n"
        
    # 3. Adzuna Jobs
    digest_msg += "\n🌍 <b>Top Openings on Adzuna (Developer):</b>\n"
    if adzuna:
        for a in adzuna:
            url = a.get("url") or a.get("redirect_url")
            if not url or str(url).strip().lower() == "none":
                digest_msg += f"• {escape_html(a.get('title'))} at <i>{escape_html(a.get('company'))}</i>\n"
            else:
                digest_msg += f"• <a href='{escape_html(url)}'>{escape_html(a.get('title'))}</a> at <i>{escape_html(a.get('company'))}</i>\n"
    else:
        digest_msg += "🏝️ No Adzuna listings found.\n"
        
    # 4. Cross-Source JOIN summary
    digest_msg += (
        f"\n⚡ <b>Cross-Source Intelligence Summary:</b>\n"
        f"Matched open issues in <code>withcoral/coral</code> against active Software positions in <code>remotive.jobs</code>. "
        f"You can execute live custom SQL JOIN operations via the dashboard or by chatting with the bot directly!"
    )

    async with httpx.AsyncClient() as client:
        tgt = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        await client.post(tgt, json={"chat_id": chat_id, "text": digest_msg, "parse_mode": "HTML"})
    return {"status": "digest_pushed"}



# ─── Settings / API Key Manager Endpoints ──────────────────────────────
class PasswordSetupRequest(BaseModel):
    password: str

class PasswordVerifyRequest(BaseModel):
    password: str

class KeysUpdateRequest(BaseModel):
    password: str
    keys: dict

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@app.get("/api/settings/status")
def get_settings_status():
    setup = os.path.exists(CONFIG_FILE)
    if setup:
        try:
            with open(CONFIG_FILE, "r") as f:
                config = json.load(f)
            setup = "password_hash" in config
        except Exception:
            setup = False
    return {"setup": setup}

@app.post("/api/settings/setup")
def setup_password(req: PasswordSetupRequest):
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                config = json.load(f)
            if "password_hash" in config:
                raise HTTPException(status_code=400, detail="Password already configured.")
        except Exception:
            pass
            
    h, salt = hash_password(req.password)
    config = {"password_hash": h, "salt": salt}
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f)
    return {"ok": True}

@app.post("/api/settings/verify")
def verify_password(req: PasswordVerifyRequest):
    if not verify_password_hash(req.password):
        raise HTTPException(status_code=401, detail="Wrong password")
    return {"ok": True}

@app.post("/api/settings/keys/get")
def get_keys(req: PasswordVerifyRequest):
    if not verify_password_hash(req.password):
        raise HTTPException(status_code=401, detail="Wrong password")
    load_env_file()
    return {
        "keys": {
            "GEMINI_API_KEY": os.environ.get("GEMINI_API_KEY", ""),
            "TELEGRAM_BOT_TOKEN": os.environ.get("TELEGRAM_BOT_TOKEN", ""),
            "GITHUB_TOKEN": os.environ.get("GITHUB_TOKEN", ""),
            "GEMINI_MODEL": os.environ.get("GEMINI_MODEL", "gemini-3.5-flash")
        }
    }

@app.post("/api/settings/keys/update")
async def update_keys(req: KeysUpdateRequest):
    if not verify_password_hash(req.password):
        raise HTTPException(status_code=401, detail="Wrong password")
        
    env_lines = []
    if os.path.exists(ENV_FILE):
        try:
            with open(ENV_FILE, "r") as f:
                env_lines = f.readlines()
        except Exception:
            pass

    parsed = {}
    for i, line in enumerate(env_lines):
        sline = line.strip()
        if sline and not sline.startswith("#") and "=" in line:
            k, _ = sline.split("=", 1)
            parsed[k.strip()] = i

    for k, v in req.keys.items():
        k = k.strip()
        v = v.strip()
        if k in parsed:
            env_lines[parsed[k]] = f"{k}={v}\n"
        else:
            env_lines.append(f"{k}={v}\n")

    try:
        with open(ENV_FILE, "w") as f:
            f.writelines(env_lines)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write .env: {e}")

    reload_keys_in_memory()
    
    chat_id = get_latest_chat_id()
    if chat_id and TELEGRAM_BOT_TOKEN:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        msg = f"🔑 <b>Security Notification</b>\n\nAPI keys have been updated successfully in your workspace settings at <i>{timestamp}</i>."
        try:
            async with httpx.AsyncClient() as client:
                tgt = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
                await client.post(tgt, json={"chat_id": chat_id, "text": msg, "parse_mode": "HTML"})
        except Exception as e:
            print(f"Failed to send Telegram notification: {e}")
            
    return {"ok": True, "updated": list(req.keys.keys())}

@app.post("/api/settings/change_password")
def change_password(req: ChangePasswordRequest):
    if not verify_password_hash(req.current_password):
        raise HTTPException(status_code=401, detail="Wrong current password")
        
    h, salt = hash_password(req.new_password)
    config = {"password_hash": h, "salt": salt}
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f)
    return {"ok": True}

@app.post("/api/settings/forgot_password")
async def forgot_password_recovery():
    chat_id = get_latest_chat_id()
    if not chat_id:
        raise HTTPException(
            status_code=400, 
            detail="Cannot recover password: No active Telegram chat alignment found. Please send a message to the bot first."
        )
        
    recovery_pwd = secrets.token_hex(4)
    h, salt = hash_password(recovery_pwd)
    
    config = {"password_hash": h, "salt": salt}
    try:
        with open(CONFIG_FILE, "w") as f:
            json.dump(config, f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset password: {e}")
        
    msg = (
        f"🔑 <b>ContriMatch Security Alert</b>\n\n"
        f"A settings password recovery was initiated.\n"
        f"Your password has been reset to: <code>{recovery_pwd}</code>\n\n"
        f"Please use this temporary password to log in and update your password immediately."
    )
    
    async with httpx.AsyncClient() as client:
        tgt = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        await client.post(tgt, json={"chat_id": chat_id, "text": msg, "parse_mode": "HTML"})
        
    return {"status": "sent"}


# ─── NL → SQL Agent ────────────────────────────────────────────────────
class AskRequest(BaseModel):
    question: str


@app.post("/api/ask")
def ask_agent(req: AskRequest):
    """Natural-language to SQL with an autonomous self-healing execution loop."""
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not set")

    # Step 1: Initial natural language compilation
    sql = nl_to_sql(req.question, GEMINI_API_KEY)

    try:
        # Attempt primary execution
        data = run_coral(sql)
        error_logs = None
    except HTTPException as first_err:
        # STEP 2: AUTONOMOUS SELF-HEALING LAYER
        # Capture the raw terminal compilation error from the Coral CLI
        error_logs = first_err.detail
        
        healing_prompt = f"""
        The previous SQL query you generated failed with a syntax or schema validation error.
        Original Question: {req.question}
        Broken SQL Generated: {sql}
        Coral CLI Error Message: {error_logs}
        
        Analyze the error message carefully. Regenerate the corrected Coral SQL query. 
        Follow all original system guidelines strictly. Return ONLY the raw SQL query string.
        """
        # Re-request corrected syntax using the error feedback loop
        sql = nl_to_sql(healing_prompt, GEMINI_API_KEY)
        
        try:
            # Re-attempt execution with healed query
            data = run_coral(sql)
            error_logs = None  # Error cleared successfully
        except HTTPException as second_err:
            return {
                "question": req.question,
                "sql": sql,
                "error": f"Self-healing loop failed. Final Error: {second_err.detail}",
                "data": [],
                "healed": False
            }

    return {
        "question": req.question,
        "sql": sql,
        "data": data,
        "count": len(data),
        "healed": (error_logs is not None)
    }


# ─── Telegram Polling Loop ────────────────────────────────────────────
def start_telegram_polling():
    async def poll_loop():
        # Initialize last_update_id from database to avoid replying to old updates
        last_update_id = 0
        try:
            init_rows = run_coral("SELECT update_id FROM telegram.updates ORDER BY update_id DESC LIMIT 1")
            if init_rows and isinstance(init_rows, list) and len(init_rows) > 0 and "update_id" in init_rows[0]:
                last_update_id = init_rows[0]["update_id"]
        except Exception as e:
            print(f"Error initializing telegram polling offset: {e}")

        print(f"Telegram polling loop active. Initial offset: {last_update_id}")

        while True:
            try:
                # Query native telegram.updates source for unhandled user messages
                sql = f"SELECT update_id, chat_id, text FROM telegram.updates WHERE offset = {last_update_id + 1} LIMIT 1"
                rows = run_coral(sql)
                
                if rows and isinstance(rows, list) and len(rows) > 0:
                    for row in rows:
                        last_update_id = row["update_id"]
                        chat_id = row["chat_id"]
                        user_prompt = row.get("text", "")
                        
                        if not user_prompt or user_prompt.startswith("/"):
                            continue # Skip empty messages or standard slash routing commands
                            
                        # Route the plain text question through the autonomous ask core
                        ai_payload = ask_agent(AskRequest(question=user_prompt))
                        
                        # Format a summary string response
                        reply = f"🤖 <b>ContriMatch Agent Response:</b>\n\n"
                        reply += f"❓ <b>Question:</b> {escape_html(user_prompt)}\n"
                        if "sql" in ai_payload:
                            reply += f"<code>{escape_html(ai_payload['sql'])}</code>\n\n"
                        
                        if ai_payload.get("error"):
                            reply += f"⚠️ <b>Error:</b> {escape_html(ai_payload['error'])}"
                        elif ai_payload.get("data"):
                            reply += f"🎯 Found <b>{ai_payload['count']}</b> matches matching your intent.\n\n"
                            # Add some preview of the results
                            for item in ai_payload["data"][:3]: # top 3 results
                                title = item.get("title") or item.get("issue") or item.get("trending") or item.get("article") or list(item.values())[0]
                                url = item.get("url") or item.get("html_url") or item.get("issue_url") or item.get("job_url")
                                if not url or str(url).strip() == "" or str(url).strip().lower() == "none":
                                    reply += f"• {escape_html(title)}\n"
                                else:
                                    reply += f"• <a href='{escape_html(url)}'>{escape_html(title)}</a>\n"
                        else:
                            reply += "🏝️ No active source rows matched this criteria."
                            
                        # Dispatch directly back to the phone
                        async with httpx.AsyncClient() as client:
                            tgt = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
                            await client.post(tgt, json={"chat_id": chat_id, "text": reply, "parse_mode": "HTML"})
            except Exception as loop_err:
                print(f"Telegram polling loop exception: {loop_err}")
            
            await asyncio.sleep(12) # Safe un-metered polling index

    def run_in_thread():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(poll_loop())

    threading.Thread(target=run_in_thread, daemon=True).start()


@app.on_event("startup")
def startup_event():
    if TELEGRAM_BOT_TOKEN:
        start_telegram_polling()
    else:
        print("Telegram polling disabled: TELEGRAM_BOT_TOKEN env var not set.")


# ─── Serve frontend ────────────────────────────────────────────────────

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn

    print("\n  🎯 ContriMatch API starting on http://localhost:8000")
    print("  📡 Sources: GitHub · Remotive · HackerNews · DEV.to")
    print("  🤖 NL→SQL: " + ("Enabled" if GEMINI_API_KEY else "Disabled (set GEMINI_API_KEY)"))
    print()
    uvicorn.run(app, host="0.0.0.0", port=8000)
