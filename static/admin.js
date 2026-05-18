(function () {
  const alertBox = document.getElementById("alertBox");
  const loginSection = document.getElementById("loginSection");
  const panelSection = document.getElementById("panelSection");
  const keysBody = document.getElementById("keysBody");
  const newKeyBox = document.getElementById("newKeyBox");
  const newKeyValue = document.getElementById("newKeyValue");

  function showAlert(msg, ok) {
    alertBox.textContent = msg;
    alertBox.className = "alert " + (ok ? "ok" : "err");
    alertBox.classList.remove("hidden");
    setTimeout(function () {
      alertBox.classList.add("hidden");
    }, 5000);
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("pt-BR");
    } catch {
      return iso;
    }
  }

  async function api(path, options) {
    const res = await fetch(path, Object.assign({ credentials: "same-origin" }, options || {}));
    const data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) {
      throw new Error(data.error || "Erro " + res.status);
    }
    return data;
  }

  function showPanel(loggedIn) {
    if (loggedIn) {
      loginSection.classList.add("hidden");
      panelSection.classList.remove("hidden");
    } else {
      loginSection.classList.remove("hidden");
      panelSection.classList.add("hidden");
    }
  }

  async function loadKeys() {
    const data = await api("/admin/api/keys");
    keysBody.innerHTML = "";
    for (const k of data.keys) {
      const tr = document.createElement("tr");
      const status = k.revokedAt ? "Revogada" : "Ativa";
      tr.innerHTML =
        "<td><code>" +
        escapeHtml(k.prefix) +
        "…</code></td>" +
        "<td>" +
        escapeHtml(k.label || "—") +
        "</td>" +
        "<td>" +
        fmtDate(k.createdAt) +
        "</td>" +
        "<td>" +
        fmtDate(k.lastUsedAt) +
        "</td>" +
        "<td>" +
        status +
        "</td>" +
        "<td></td>";
      const td = tr.lastElementChild;
      if (!k.revokedAt) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "danger";
        btn.textContent = "Revogar";
        btn.addEventListener("click", function () {
          revokeKey(k.id);
        });
        td.appendChild(btn);
      }
      keysBody.appendChild(tr);
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function revokeKey(id) {
    if (!confirm("Revogar esta chave?")) return;
    try {
      await api("/admin/api/keys/" + encodeURIComponent(id), { method: "DELETE" });
      showAlert("Chave revogada.", true);
      await loadKeys();
    } catch (e) {
      showAlert(e.message, false);
    }
  }

  document.getElementById("btnLogin").addEventListener("click", async function () {
    try {
      await api("/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario: document.getElementById("usuario").value,
          senha: document.getElementById("senha").value
        })
      });
      showPanel(true);
      await loadKeys();
    } catch (e) {
      showAlert(e.message, false);
    }
  });

  document.getElementById("btnLogout").addEventListener("click", async function () {
    try {
      await api("/admin/logout", { method: "POST" });
    } catch {
    }
    showPanel(false);
    newKeyBox.classList.add("hidden");
  });

  document.getElementById("btnCreate").addEventListener("click", async function () {
    try {
      const data = await api("/admin/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: document.getElementById("label").value })
      });
      newKeyValue.textContent = data.key;
      newKeyBox.classList.remove("hidden");
      showAlert("Chave criada.", true);
      await loadKeys();
    } catch (e) {
      showAlert(e.message, false);
    }
  });

  (async function init() {
    try {
      await loadKeys();
      showPanel(true);
    } catch {
      showPanel(false);
    }
  })();
})();
