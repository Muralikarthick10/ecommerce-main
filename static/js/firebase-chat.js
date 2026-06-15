/* ShopKart — Firebase Firestore: real-time support chat, notifications, presence.
 * Loads only when a valid config is provided (window.SHOPKART.firebaseEnabled).
 * Degrades gracefully to a disabled state otherwise so the site always runs. */
(function () {
  "use strict";

  var cfg = window.SHOPKART || {};
  var fab = document.getElementById("chat-fab");
  var panel = document.getElementById("chat-panel");
  if (!fab || !panel) return;

  var body = panel.querySelector(".chat-body");
  var form = panel.querySelector("#chat-form");
  var input = panel.querySelector("#chat-input");
  var statusDot = panel.querySelector(".status-dot");
  var statusText = panel.querySelector("#chat-status-text");

  function togglePanel() { panel.classList.toggle("open"); if (panel.classList.contains("open") && input) input.focus(); }
  fab.addEventListener("click", togglePanel);
  var closeBtn = panel.querySelector("#chat-close");
  if (closeBtn) closeBtn.addEventListener("click", togglePanel);

  function showDisabled() {
    if (body) {
      body.innerHTML =
        '<div class="chat-disabled"><i class="fa-regular fa-comments fa-2x mb-2 d-block"></i>' +
        "Live chat isn't configured yet.<br>Add your Firebase config to enable real-time support, " +
        "notifications, and online status.</div>";
    }
    if (form) form.style.display = "none";
    if (statusText) statusText.textContent = "Offline";
    if (statusDot) statusDot.classList.add("offline");
  }

  if (!cfg.firebaseEnabled || !cfg.firebaseConfig || !cfg.firebaseConfig.apiKey) {
    showDisabled();
    return;
  }

  var FB = "https://www.gstatic.com/firebasejs/10.12.2/";

  Promise.all([
    import(FB + "firebase-app.js"),
    import(FB + "firebase-firestore.js")
  ]).then(function (mods) {
    var appMod = mods[0];
    var fs = mods[1];

    var app = appMod.initializeApp(cfg.firebaseConfig);
    var db = fs.getFirestore(app);

    var uid = cfg.userId ? "user_" + cfg.userId : "guest_" + getGuestId();
    var uname = cfg.userName || "Guest";

    /* ---------- Presence (online/offline) ---------- */
    var presenceRef = fs.doc(db, "presence", uid);
    function setOnline(state) {
      fs.setDoc(presenceRef, {
        username: uname,
        online: state,
        lastSeen: fs.serverTimestamp()
      }, { merge: true }).catch(function () {});
    }
    setOnline(true);
    var heartbeat = setInterval(function () { setOnline(true); }, 30000);
    window.addEventListener("beforeunload", function () { setOnline(false); });
    document.addEventListener("visibilitychange", function () {
      setOnline(document.visibilityState === "visible");
    });

    // Reflect support availability by watching an "agents/support" doc.
    try {
      fs.onSnapshot(fs.doc(db, "agents", "support"), function (snap) {
        var online = snap.exists() && snap.data().online;
        if (statusDot) statusDot.classList.toggle("offline", !online);
        if (statusText) statusText.textContent = online ? "We're online" : "Leave a message";
      });
    } catch (e) { /* ignore */ }

    /* ---------- Support chat (per-user thread) ---------- */
    var msgsRef = fs.collection(db, "supportChats", uid, "messages");
    var q = fs.query(msgsRef, fs.orderBy("createdAt", "asc"), fs.limit(100));

    fs.onSnapshot(q, function (snap) {
      if (!body) return;
      body.innerHTML = "";
      if (snap.empty) {
        body.innerHTML = '<div class="chat-disabled">👋 Hi ' + escapeHtml(uname) +
          "! Send us a message and our team will reply here.</div>";
      }
      snap.forEach(function (docSnap) {
        var d = docSnap.data();
        var div = document.createElement("div");
        div.className = "chat-msg " + (d.from === "support" ? "them" : "me");
        div.textContent = d.text || "";
        body.appendChild(div);
      });
      body.scrollTop = body.scrollHeight;
    }, function () { showDisabled(); });

    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var text = (input.value || "").trim();
        if (!text) return;
        input.value = "";
        fs.addDoc(msgsRef, {
          text: text,
          from: "user",
          username: uname,
          createdAt: fs.serverTimestamp()
        }).catch(function () {
          if (window.showToast) window.showToast("Couldn't send message.", "danger");
        });
      });
    }

    /* ---------- Notifications ---------- */
    var notifBtn = document.getElementById("notif-btn");
    var notifBadge = document.getElementById("notif-badge");
    if (cfg.userId) {
      try {
        var notifRef = fs.collection(db, "notifications", "user_" + cfg.userId, "items");
        var nq = fs.query(notifRef, fs.orderBy("createdAt", "desc"), fs.limit(20));
        var first = true;
        fs.onSnapshot(nq, function (snap) {
          var unread = 0;
          var list = document.getElementById("notif-list");
          if (list) list.innerHTML = "";
          snap.forEach(function (docSnap) {
            var d = docSnap.data();
            if (!d.read) unread++;
            if (list) {
              var li = document.createElement("li");
              li.innerHTML = '<span class="dropdown-item-text small">' + escapeHtml(d.text || "") + "</span>";
              list.appendChild(li);
            }
          });
          if (list && !list.children.length) {
            list.innerHTML = '<li><span class="dropdown-item-text small text-muted">No notifications yet</span></li>';
          }
          if (notifBadge) {
            notifBadge.textContent = unread;
            notifBadge.style.display = unread ? "inline-block" : "none";
          }
          if (!first && unread && window.showToast) {
            window.showToast("You have a new notification", "info");
          }
          first = false;
        });
      } catch (e) { /* ignore */ }
    }
  }).catch(function () {
    showDisabled();
  });

  function getGuestId() {
    var id = localStorage.getItem("sk-guest");
    if (!id) { id = Math.random().toString(36).slice(2, 12); localStorage.setItem("sk-guest", id); }
    return id;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();