let username = "User";
let loadedMessages = 0;
let currentChatId = null;
let currentProjectId = null;
let projectFiles = [];
let projectFolders = [];
let isSending = false;

const api_url = "http://127.0.0.1:5000";
const auth_url = "http://127.0.0.1:5000";

function prechatMessages() {
    return [
        `Hey, ${username}, what'll we create today?`,
        `What's the move, ${username}?`,
        `Any exciting projects today, ${username}?`,
        `Welcome back, ${username}. What's on your mind?`,
        `What are we working on today, ${username}?`,
        `Got any ideas brewing, ${username}?`,
        `Ready to make something awesome, ${username}?`,
        `What's up, ${username}?`,
        `What can I help you with today, ${username}?`,
        `Let's hear your ideas, ${username}.`,
        `Anything interesting you'd like to explore, ${username}?`,
        `What are we building today, ${username}?`,
        `Got a challenge for me, ${username}?`,
        `What brings you here today, ${username}?`,
        `Let's get creative, ${username}. What's the plan?`,
        `Your next idea starts here, ${username}.`,
        `Need a hand with something, ${username}?`,
        `What have you been thinking about, ${username}?`,
        `Let's make some progress today, ${username}.`,
        `What's the plan of action, ${username}?`,
        `Anything I can help you figure out, ${username}?`,
        `So, what are we diving into today, ${username}?`,
        `Got something cool in mind, ${username}?`,
        `I'm ready when you are, ${username}. What's up?`,
        `Let's see what you've got, ${username}.`
    ];
}

function start() {
    loadedMessages = 0;
    checkSavedSession();
}

function switchPage(newPage, oldPage) {
    const np = document.getElementById(newPage);
    const op = document.getElementById(oldPage);
    if (np) {
        np.style.display = 'flex';
    }
    if (op) {
        op.style.display = 'none';
    }
}

function randomizeMessage() {
    const message = document.getElementById("prechatmessage");
    const options = prechatMessages();
    const randomIndex = Math.floor(Math.random() * options.length);
    message.textContent = options[randomIndex];
}

function updatePrechatMessage() {
    const message = document.getElementById("prechatmessage");

    if (loadedMessages === 0) {
        message.style.display = "flex";
    } else {
        message.style.display = "none";
    }
}

function updateMentionWarning() {
    const input = document.getElementById("message-input");
    const warning = document.getElementById("mention-warning");

    if (/@\.(?:\s|$)/.test(input.value)) {
        warning.textContent = "Sending Tev the entire project can take a very long time to read.";
        warning.style.display = "block";
    } else {
        warning.style.display = "none";
    }
}

function displayAuthenticationStatus(message, isError = true) {
    const status = document.getElementById("authenticationstatus");
    status.textContent = message;
    status.style.color = isError ? "#ff4444" : "#00cc66";
}

async function registerUser() {
    const username = document.getElementById("authusername").value.trim();
    const password = document.getElementById("authpassword").value;

    try {
        const response = await fetch(`${auth_url}/register`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            displayAuthenticationStatus(
                data.error || data.message || "Registration failed."
            );
            return;
        }

        loadMain(data.username || username);

    } catch (error) {
        displayAuthenticationStatus("Unable to connect to the server.");
    }
}

async function loginUser() {
    const username = document.getElementById("authusername").value.trim();
    const password = document.getElementById("authpassword").value;

    try {
        const response = await fetch(`${auth_url}/login`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            displayAuthenticationStatus(
                data.error || data.message || "Login failed."
            );
            return;
        }

        loadMain(data.username || username);

    } catch (error) {
        displayAuthenticationStatus("Unable to connect to the server.");
    }
}

function loadMain(name) {
    username = name;

    document.getElementById("accountname").textContent = name;
    document.getElementById("authentication").style.display = "none";
    document.getElementById("main").style.display = "flex";

    startNewChat();
    loadProjects();
}

async function checkSavedSession() {
    try {
        const response = await fetch(`${auth_url}/session`, {
            credentials: "include"
        });

        if (!response.ok) {
            return;
        }

        const data = await response.json();
        loadMain(data.username);

    } catch (error) {
        console.error("Unable to restore login session:", error);
    }
}

async function logoutUser() {
    try {
        const response = await fetch(`${auth_url}/logout`, {
            method: "POST",
            credentials: "include"
        });

        if (!response.ok) {
            displayAuthenticationStatus("Unable to log out.");
            return;
        }

        username = "User";
        currentChatId = null;
        currentProjectId = null;
        projectFiles = [];
        projectFolders = [];

        clearMessages();

        document.getElementById("chats").replaceChildren();
        document.getElementById("projects").replaceChildren();
        document.getElementById("authusername").value = "";
        document.getElementById("authpassword").value = "";
        document.getElementById("authentication").style.display = "flex";
        document.getElementById("main").style.display = "none";

    } catch (error) {
        displayAuthenticationStatus("Unable to connect to the server.");
    }
}

async function api(path, method = "GET", body = null) {
    const response = await fetch(`${api_url}${path}`, {
        method: method,
        credentials: "include",
        headers: {
            "Content-Type": "application/json"
        },
        body: body ? JSON.stringify(body) : undefined
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.error || data.message || "Request failed."
        );
    }

    return data;
}

function makeButton(label, className, onClick) {
    const button = document.createElement("button");
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", onClick);

    return button;
}

function clearMessages() {
    document.querySelectorAll(
        "#messages .usermessage, #messages .tevmessage"
    ).forEach(element => element.remove());

    loadedMessages = 0;
}

function renderMentionSpans(text) {
    const fragment = document.createDocumentFragment();
    const regex = /([@~]\S+)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            fragment.append(text.slice(lastIndex, match.index));
        }

        const highlight = document.createElement("span");

        highlight.className = match[0].startsWith("~")
            ? "mention-highlight mention-exclusion-highlight"
            : "mention-highlight";

        highlight.style.color = match[0].startsWith("~")
            ? "#ff4444"
            : "#ffc800";

        highlight.textContent = match[0];
        fragment.appendChild(highlight);

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        fragment.append(text.slice(lastIndex));
    }

    return fragment;
}

function addUserMessage(text) {
    const usermessage = document.createElement("div");
    usermessage.classList.add("usermessage");

    const name = document.createElement("h4");
    name.textContent = username;

    const message = document.createElement("p");
    message.appendChild(renderMentionSpans(text));

    usermessage.append(name, message);

    const container = document.querySelector("#messages");
    container.appendChild(usermessage);
    container.scrollTop = container.scrollHeight;

    loadedMessages++;
    updatePrechatMessage();
}

function parseInlineFormatting(text, element) {
    const parts = text.split(/\*\*([\s\S]*?)\*\*/g);

    parts.forEach((part, index) => {
        if (!part) {
            return;
        }

        if (index % 2 === 1) {
            const em = document.createElement("em");
            em.textContent = part;
            element.appendChild(em);
        } else {
            element.append(part);
        }
    });
}

function parseTevContent(text) {
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "4px";
    container.style.width = "100%";

    const parts = text.split(/```([a-zA-Z0-9_.-]+(?:[\s:][/\w.-]+)?)\n([\s\S]*?)```/g);

    for (let i = 0; i < parts.length; i++) {
        if (i % 3 === 1) {
            const rawHeader = parts[i] || "code";
            const codeText = parts[i + 1] ? parts[i + 1].trim() : "";

            let [language, explicitFile] = rawHeader.split(/[:\s]+/, 2);

            const codeWrapper = document.createElement("div");
            codeWrapper.className = "code-block-wrapper";

            const header = document.createElement("div");
            header.className = "code-header";

            const langSpan = document.createElement("span");
            langSpan.textContent = explicitFile ? `${language} (${explicitFile})` : language;

            const buttonGroup = document.createElement("div");
            buttonGroup.style.display = "flex";
            buttonGroup.style.gap = "8px";

            const applyBtn = document.createElement("button");
            applyBtn.textContent = "Apply Changes";
            applyBtn.className = "copy-code-btn";

            applyBtn.addEventListener("click", async () => {
                if (!currentProjectId) {
                    alert("Please connect a project first before applying changes.");
                    return;
                }

                let filepath = explicitFile;
                if (!filepath) {
                    filepath = prompt("Enter the relative file path to update (e.g. server.py, script.js):", "");
                    if (!filepath || !filepath.trim()) {
                        return;
                    }
                }

                applyBtn.textContent = "Applying...";
                applyBtn.disabled = true;

                try {
                    await api(`/projects/${currentProjectId}/save_file`, "POST", {
                        filepath: filepath.trim(),
                        content: codeText
                    });
                    applyBtn.textContent = "Applied!";
                    setTimeout(() => {
                        applyBtn.textContent = "Apply Changes";
                        applyBtn.disabled = false;
                    }, 2000);
                } catch (error) {
                    alert(`Failed to apply changes: ${error.message}`);
                    applyBtn.textContent = "Apply Changes";
                    applyBtn.disabled = false;
                }
            });

            const copyBtn = document.createElement("button");
            copyBtn.textContent = "Copy code";
            copyBtn.className = "copy-code-btn";

            copyBtn.addEventListener("click", () => {
                navigator.clipboard.writeText(codeText).then(() => {
                    copyBtn.textContent = "Copied!";

                    setTimeout(() => {
                        copyBtn.textContent = "Copy code";
                    }, 2000);
                });
            });

            buttonGroup.append(applyBtn, copyBtn);
            header.append(langSpan, buttonGroup);

            const pre = document.createElement("pre");
            pre.className = "code-content";

            const code = document.createElement("code");
            code.textContent = codeText;
            pre.appendChild(code);

            codeWrapper.append(header, pre);
            container.appendChild(codeWrapper);

            i++;
        } else {
            const part = parts[i];

            if (!part) {
                continue;
            }

            const lines = part.split("\n");

            lines.forEach(line => {
                const p = document.createElement("p");
                const trimmed = line.trim();

                if (trimmed.startsWith("##")) {
                    const strong = document.createElement("strong");
                    strong.textContent = trimmed.replace(/^##\s*/, "");
                    p.appendChild(strong);
                } else {
                    parseInlineFormatting(line, p);
                }

                container.appendChild(p);
            });
        }
    }

    return container;
}

function tevResponse(text) {
    const tevmessage = document.createElement("div");
    tevmessage.classList.add("tevmessage");

    const name = document.createElement("h4");
    name.textContent = "Tev";

    const contentContainer = document.createElement("div");
    contentContainer.style.width = "100%";
    contentContainer.appendChild(parseTevContent(text));

    tevmessage.append(name, contentContainer);

    const container = document.querySelector("#messages");
    container.appendChild(tevmessage);
    container.scrollTop = container.scrollHeight;
}

function tevStreamingResponse() {
    const tevmessage = document.createElement("div");
    tevmessage.classList.add("tevmessage");

    const name = document.createElement("h4");
    name.textContent = "Tev";

    const contentContainer = document.createElement("div");
    contentContainer.style.width = "100%";

    tevmessage.append(name, contentContainer);

    const container = document.querySelector("#messages");
    container.appendChild(tevmessage);
    container.scrollTop = container.scrollHeight;

    let dotInterval = null;
    let dotCount = 1;
    let hasReceivedContent = false;

    contentContainer.textContent = ".";
    dotInterval = setInterval(() => {
        if (!hasReceivedContent) {
            dotCount = (dotCount % 3) + 1;
            contentContainer.textContent = ".".repeat(dotCount);
            container.scrollTop = container.scrollHeight;
        }
    }, 500);

    return {
        update(text) {
            if (!hasReceivedContent && text.trim() !== "") {
                hasReceivedContent = true;
                if (dotInterval) {
                    clearInterval(dotInterval);
                    dotInterval = null;
                }
            }
            contentContainer.replaceChildren(parseTevContent(text));
            container.scrollTop = container.scrollHeight;
        },
        stop() {
            if (dotInterval) {
                clearInterval(dotInterval);
                dotInterval = null;
            }
        }
    };
}

async function loadChats() {
    const list = document.getElementById("chats");

    const endpoint = currentProjectId !== null
        ? `/chats?project_id=${currentProjectId}`
        : "/chats";

    const saved = await api(endpoint);
    list.replaceChildren();

    if (saved.length === 0) {
        const empty = document.createElement("p");

        empty.textContent = currentProjectId !== null
            ? "No chats for this project..."
            : "No chats yet...";

        list.appendChild(empty);
    }

    for (const chat of saved) {
        const row = document.createElement("div");
        row.className = "chat-row";

        const open = makeButton(
            chat.title,
            "chat-item",
            () => openChat(chat.id)
        );

        open.classList.toggle("active", chat.id === currentChatId);

        const renameBtn = makeButton("I", "chat-action", () => {
            const input = document.createElement("input");
            input.type = "text";
            input.className = "chat-item";
            input.style.background = "#1a1a1a";
            input.style.color = "#fff";
            input.style.border = "1px solid #ffc800";
            input.style.outline = "none";
            input.style.padding = "4px 8px";
            input.style.borderRadius = "4px";
            input.value = chat.title;

            row.replaceChild(input, open);
            input.focus();
            input.select();

            let savedState = false;

            async function save() {
                if (savedState) {
                    return;
                }
                savedState = true;

                const newTitle = input.value.trim();
                if (!newTitle || newTitle === chat.title) {
                    row.replaceChild(open, input);
                    return;
                }

                try {
                    await api(`/chats/${chat.id}`, "PATCH", { title: newTitle });
                    chat.title = newTitle;
                    open.textContent = newTitle;
                    row.replaceChild(open, input);
                } catch (error) {
                    alert(`Failed to rename chat: ${error.message}`);
                    row.replaceChild(open, input);
                }
            }

            input.addEventListener("keydown", async (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    await save();
                } else if (e.key === "Escape") {
                    row.replaceChild(open, input);
                }
            });

            input.addEventListener("blur", async () => {
                await save();
            });
        });

        const deleteBtn = makeButton("X", "chat-action", () => deleteChat(chat));

        row.append(open, renameBtn, deleteBtn);
        list.appendChild(row);
    }
}

async function renameChat(chat) {
    if (isSending) {
        return;
    }

    const newTitle = prompt("Enter a new title for the chat:", chat.title);

    if (!newTitle || !newTitle.trim()) {
        return;
    }

    try {
        await api(`/chats/${chat.id}`, "PATCH", { title: newTitle.trim() });
        await loadChats();
    } catch (error) {
        alert(`Failed to rename chat: ${error.message}`);
    }
}

async function openChat(id) {
    if (isSending) {
        return;
    }

    const saved = await api(`/chats/${id}`);

    currentChatId = id;
    currentProjectId = null;
    projectFiles = [];
    projectFolders = [];

    clearMessages();

    for (const row of saved) {
        if (row.role === "user") {
            addUserMessage(row.content);
        } else {
            tevResponse(row.content);
        }
    }

    updatePrechatMessage();
    await loadChats();
}

async function loadProjects() {
    const list = document.getElementById("projects");

    if (!list) {
        return;
    }

    const saved = await api("/projects");
    list.replaceChildren();

    if (saved.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = "No projects yet...";
        list.appendChild(empty);
    }

    for (const project of saved) {
        const row = document.createElement("div");
        row.className = "chat-row";

        const open = makeButton(
            project.name,
            "chat-item",
            () => openProject(project.id)
        );

        open.classList.toggle("active", project.id === currentProjectId);

        const renameBtn = makeButton("I", "chat-action", () => {
            const input = document.createElement("input");
            input.type = "text";
            input.className = "chat-item";
            input.style.background = "#1a1a1a";
            input.style.color = "#fff";
            input.style.border = "1px solid #ffc800";
            input.style.outline = "none";
            input.style.padding = "4px 8px";
            input.style.borderRadius = "4px";
            input.value = project.name;

            row.replaceChild(input, open);
            input.focus();
            input.select();

            let savedState = false;

            async function save() {
                if (savedState) {
                    return;
                }
                savedState = true;

                const newName = input.value.trim();
                if (!newName || newName === project.name) {
                    row.replaceChild(open, input);
                    return;
                }

                try {
                    await api(`/projects/${project.id}`, "PATCH", { name: newName });
                    project.name = newName;
                    open.textContent = newName;
                    row.replaceChild(open, input);
                } catch (error) {
                    alert(`Failed to rename project: ${error.message}`);
                    row.replaceChild(open, input);
                }
            }

            input.addEventListener("keydown", async (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    await save();
                } else if (e.key === "Escape") {
                    row.replaceChild(open, input);
                }
            });

            input.addEventListener("blur", async () => {
                await save();
            });
        });

        const deleteBtn = makeButton("X", "chat-action", () => deleteProject(project));

        row.append(open, renameBtn, deleteBtn);
        list.appendChild(row);
    }
}

async function renameProject(project) {
    if (isSending) {
        return;
    }

    const newName = prompt("Enter a new name for the project:", project.name);

    if (!newName || !newName.trim()) {
        return;
    }

    try {
        await api(`/projects/${project.id}`, "PATCH", { name: newName.trim() });
        await loadProjects();
    } catch (error) {
        alert(`Failed to rename project: ${error.message}`);
    }
}

async function loadProjectFiles(id) {
    try {
        projectFiles = await api(`/projects/${id}/files`);
    } catch (error) {
        console.error("Unable to load project files:", error);
        projectFiles = [];
    }
}

async function loadProjectFolders(id) {
    try {
        projectFolders = await api(`/projects/${id}/folders`);
    } catch (error) {
        console.error("Unable to load project folders:", error);
        projectFolders = [];
    }
}

async function openProject(id) {
    if (isSending) {
        return;
    }

    currentProjectId = id;
    currentChatId = null;

    clearMessages();

    await Promise.all([
        loadProjectFiles(id),
        loadProjectFolders(id)
    ]);

    const saved = await api(`/projects/${id}/messages`);

    for (const row of saved) {
        if (row.role === "user") {
            addUserMessage(row.content);
        } else {
            tevResponse(row.content);
        }
    }

    updatePrechatMessage();
    await loadProjects();

    document.getElementById("message-input").focus();
}

function startNewChat() {
    if (isSending) {
        return;
    }

    currentChatId = null;
    currentProjectId = null;
    projectFiles = [];
    projectFolders = [];

    clearMessages();
    randomizeMessage();
    updatePrechatMessage();

    loadChats().catch(console.error);
    loadProjects().catch(console.error);

    document.getElementById("message-input").focus();
}

async function deleteChat(chat) {
    if (isSending || !confirm(`Delete "${chat.title}"?`)) {
        return;
    }

    await api(`/chats/${chat.id}`, "DELETE");

    if (chat.id === currentChatId) {
        startNewChat();
        return;
    }

    await loadChats();
}

async function sendMessage() {
    const input = document.getElementById("message-input");
    const inputValue = input.value.trim();

    if (!inputValue || isSending) {
        return;
    }

    isSending = true;
    
    input.value = "";
    updateBackdrop();
    autoGrowInput();
    hideSuggestions();
    addUserMessage(inputValue);

    const streamer = tevStreamingResponse();

    try {
        if (!currentChatId && !currentProjectId) {
            const created = await api("/chats", "POST");
            currentChatId = created.id;
        }

        const response = await fetch(`${api_url}/tev_response`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: inputValue,
                chat_id: currentChatId,
                project_id: currentProjectId
            })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || data.message || "Request failed.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let fullText = "";
        let buffer = "";

        while (true) {
            const { value, done } = await reader.read();

            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });

            while (buffer.includes("\x00STATUS\x00")) {
                const start = buffer.indexOf("\x00STATUS\x00") + 8;
                const end = buffer.indexOf("\x00", start);

                if (end === -1) {
                    break;
                }

                const status = buffer.slice(start, end);
                buffer = buffer.slice(end + 1);

                if (status) {
                    streamer.update(`[${status}]`);
                } else {
                    streamer.update("");
                    fullText = "";
                }
            }

            fullText += buffer;
            buffer = "";

            if (fullText) {
                if (fullText.includes("[Error:") && (
                    fullText.toLowerCase().includes("rate") || 
                    fullText.toLowerCase().includes("limit") || 
                    fullText.toLowerCase().includes("large") || 
                    fullText.toLowerCase().includes("quota") || 
                    fullText.toLowerCase().includes("token") || 
                    fullText.toLowerCase().includes("exceed")
                )) {
                    fullText = "Out of storage. Please try again later!";
                }
                streamer.update(fullText);
            }
        }

        if (!currentProjectId) {
            await loadChats();
        }

    } catch (error) {
        console.error("Error contacting Tev:", error);
        streamer.update(`Error: ${error.message}`);

    } finally {
        isSending = false;
        streamer.stop();
        updateBackdrop();
        autoGrowInput();
        input.focus();
    }
}

async function connectProject() {
    if (!window.tevApp || !window.tevApp.selectFolder) {
        alert("Folder selection is only available in the desktop app.");
        return;
    }

    const folderPath = await window.tevApp.selectFolder();

    if (!folderPath) {
        return;
    }

    const name = folderPath.split(/[\\/]/).pop() || folderPath;

    const created = await api(
        "/projects",
        "POST",
        {
            name: name,
            path: folderPath
        }
    );

    await openProject(created.id);
}

async function deleteProject(project) {
    if (!confirm(`Disconnect "${project.name}"?`)) {
        return;
    }

    await api(`/projects/${project.id}`, "DELETE");

    if (project.id === currentProjectId) {
        currentProjectId = null;
        projectFiles = [];
        projectFolders = [];

        startNewChat();
    }

    await loadProjects();
}

function updateBackdrop() {
    const input = document.getElementById("message-input");
    const backdrop = document.getElementById("input-backdrop");

    backdrop.replaceChildren(renderMentionSpans(input.value));
    backdrop.append("\u200b");
    backdrop.scrollTop = input.scrollTop;
}

function autoGrowInput() {
    const input = document.getElementById("message-input");
    const backdrop = document.getElementById("input-backdrop");

    input.style.height = "auto";

    const newHeight = Math.min(input.scrollHeight, 150);

    input.style.height = `${newHeight}px`;
    backdrop.style.height = `${newHeight}px`;
}

function getMentionContext(input) {
    const pos = input.selectionStart;
    const text = input.value;
    const upto = text.slice(0, pos);

    const atIndex = upto.lastIndexOf("@");
    const tildeIndex = upto.lastIndexOf("~");
    const start = Math.max(atIndex, tildeIndex);

    if (start === -1) {
        return null;
    }

    const marker = text[start];
    const before = upto.slice(0, start);

    if (before.length > 0 && !/\s$/.test(before)) {
        return null;
    }

    const query = upto.slice(start + 1);

    if (/\s/.test(query)) {
        return null;
    }

    return {
        start,
        end: pos,
        query,
        marker
    };
}

function getProjectFolders() {
    return [...new Set(projectFolders)]
        .filter(path => path && path.trim().length > 0)
        .sort((a, b) => {
            const depthA = a.split("/").length;
            const depthB = b.split("/").length;

            if (depthA !== depthB) {
                return depthA - depthB;
            }

            return a.localeCompare(b);
        });
}

function hideSuggestions() {
    const box = document.getElementById("mention-suggestions");
    box.replaceChildren();
    box.style.display = "none";
}

function applyMention(context, path) {
    const input = document.getElementById("message-input");
    const value = input.value;

    const before = value.slice(0, context.start);
    const after = value.slice(context.end);
    const inserted = `${context.marker}${path} `;

    input.value = before + inserted + after;

    const newPos = (before + inserted).length;

    input.focus();
    input.setSelectionRange(newPos, newPos);

    updateBackdrop();
    autoGrowInput();
    hideSuggestions();
}

function updateSuggestions() {
    const input = document.getElementById("message-input");
    const box = document.getElementById("mention-suggestions");
    const context = getMentionContext(input);

    if (
        !context ||
        !currentProjectId ||
        (projectFiles.length === 0 && projectFolders.length === 0)
    ) {
        hideSuggestions();
        return;
    }

    const query = context.query.toLowerCase().replace(/\\/g, "/");

    const suggestions = [...projectFolders, ...projectFiles];

    const matches = suggestions
        .filter(path => {
            const normalizedPath = path.replace(/\\/g, "/").toLowerCase();

            return (
                normalizedPath.includes(query) ||
                normalizedPath.split("/").some(part => part.includes(query))
            );
        })
        .sort((a, b) => {
            const pathA = a.toLowerCase();
            const pathB = b.toLowerCase();

            const startsA = pathA.startsWith(query);
            const startsB = pathB.startsWith(query);

            if (startsA !== startsB) {
                return startsA ? -1 : 1;
            }

            return a.localeCompare(b);
        })
        .slice(0, 8);

    if (matches.length === 0) {
        hideSuggestions();
        return;
    }

    box.replaceChildren();

    for (const path of matches) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = context.marker === "~"
            ? "mention-suggestion exclusion-suggestion"
            : "mention-suggestion";

        button.style.color = context.marker === "~"
            ? "#ff4444"
            : "#ffc800";

        button.textContent = path;
        button.addEventListener("click", () => applyMention(context, path));

        box.appendChild(button);
    }

    box.style.display = "flex";
}

start();

document.getElementById("new-chat").addEventListener(
    "click",
    startNewChat
);

document.getElementById("connect-project").addEventListener(
    "click",
    connectProject
);

const messageInput = document.getElementById("message-input");

messageInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
        return;
    }

    if (event.key === "Enter" && event.shiftKey) {
        event.preventDefault();

        const start = this.selectionStart;
        const end = this.selectionEnd;
        const value = this.value;

        this.value = (
            value.substring(0, start) +
            "\n" +
            value.substring(end)
        );

        this.selectionStart = this.selectionEnd = start + 1;

        updateBackdrop();
        autoGrowInput();
    }
});

messageInput.addEventListener("input", function () {
    updateBackdrop();
    autoGrowInput();
    updateSuggestions();
    updateMentionWarning();
});

messageInput.addEventListener("click", updateSuggestions);
messageInput.addEventListener("keyup", updateSuggestions);
messageInput.addEventListener("scroll", updateBackdrop);

document.addEventListener("click", event => {
    const wrapper = document.getElementById("input-wrapper");

    if (!wrapper.contains(event.target)) {
        hideSuggestions();
    }
});