const messages = document.querySelector("#messages");
const empty = document.querySelector("#empty");
const form = document.querySelector("#composer");
const nickname = document.querySelector("#nickname");
const body = document.querySelector("#body");
const error = document.querySelector("#error");
const copyLink = document.querySelector("#copy-link");
let latestId = 0;
let loading = false;

nickname.value = localStorage.getItem("tarantula-chat-name") ?? "";

function appendMessage(message) {
  const item = document.createElement("li");
  const head = document.createElement("div");
  const name = document.createElement("strong");
  const time = document.createElement("time");
  const text = document.createElement("p");

  name.textContent = message.nickname;
  time.dateTime = new Date(message.createdAt).toISOString();
  time.textContent = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  text.textContent = message.body;
  head.append(name, time);
  item.append(head, text);
  messages.append(item);
  latestId = Math.max(latestId, Number(message.id));
}

async function loadMessages() {
  if (loading || document.hidden) return;
  loading = true;
  try {
    const response = await fetch(`/api/messages?after=${latestId}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Could not load messages.");
    const payload = await response.json();
    for (const message of payload.messages) appendMessage(message);
    empty.hidden = messages.childElementCount > 0;
  } catch (cause) {
    error.textContent = cause instanceof Error ? cause.message : "Could not load messages.";
  } finally {
    loading = false;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  error.textContent = "";
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  localStorage.setItem("tarantula-chat-name", nickname.value.trim());
  try {
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nickname: nickname.value,
        body: body.value,
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Could not send message.");
    body.value = "";
    await loadMessages();
    body.focus();
  } catch (cause) {
    error.textContent = cause instanceof Error ? cause.message : "Could not send message.";
  } finally {
    submit.disabled = false;
  }
});

copyLink.addEventListener("click", async () => {
  await navigator.clipboard.writeText(location.href);
  copyLink.textContent = "Copied";
  window.setTimeout(() => {
    copyLink.textContent = "Copy link";
  }, 1600);
});

document.addEventListener("visibilitychange", loadMessages);
await loadMessages();
window.setInterval(loadMessages, 1200);
