// chat.js  – Lightweight helper for the Squarespace Code block

const API_URL = "https://johnny-chat.onrender.com/api/chat";   // change if your Render URL differs
const chatBox = document.querySelector("#chat-box");
const form    = document.querySelector("#ask-form");
const input   = document.querySelector("#ask-input");

function bubble(html, mine = false) {
  const div = document.createElement("div");
  div.className = mine ? "msg mine" : "msg";
  div.innerHTML = html;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

form.addEventListener("submit", async e => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  bubble(text, true);            // user
  const loading = document.createElement("div");
  loading.className = "loader";
  chatBox.appendChild(loading);
  chatBox.scrollTop = chatBox.scrollHeight;

  try {
    const r   = await fetch(API_URL, {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({ input: text })
    });
    const out = await r.json();
    loading.remove();
    if (r.ok) {
      bubble(out.reply);
    } else {
      bubble(`<b>⚠️ Server error</b><br>${out.error || r.statusText}`);
    }
  } catch (err) {
    loading.remove();
    bubble(`<b>⚠️ Network error</b><br>${err.message}`);
  }
});
