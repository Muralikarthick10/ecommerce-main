/* ShopKart — UI behaviours: loader, dark mode, toasts, reveal, image fallback */
(function () {
  "use strict";

  /* ---------- Theme (dark mode) ---------- */
  var root = document.documentElement;
  var stored = localStorage.getItem("sk-theme");
  if (stored) {
    root.setAttribute("data-theme", stored);
  } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    root.setAttribute("data-theme", "dark");
  }

  function updateThemeIcon() {
    var isDark = root.getAttribute("data-theme") === "dark";
    document.querySelectorAll("[data-theme-icon]").forEach(function (el) {
      el.className = isDark ? "fa-solid fa-sun" : "fa-solid fa-moon";
    });
  }

  window.toggleTheme = function () {
    var isDark = root.getAttribute("data-theme") === "dark";
    var next = isDark ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem("sk-theme", next);
    updateThemeIcon();
  };

  /* ---------- Page loader ---------- */
  function hideLoader() {
    var loader = document.getElementById("page-loader");
    if (loader) {
      loader.classList.add("hidden");
      setTimeout(function () { loader.remove(); }, 500);
    }
  }
  window.addEventListener("load", function () { setTimeout(hideLoader, 250); });
  // Safety fallback so the loader never traps the page.
  setTimeout(hideLoader, 3000);

  /* ---------- Toasts ---------- */
  function ensureStack() {
    var stack = document.querySelector(".toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "toast-stack";
      document.body.appendChild(stack);
    }
    return stack;
  }
  window.showToast = function (message, type) {
    var stack = ensureStack();
    var toast = document.createElement("div");
    toast.className = "app-toast " + (type || "info");
    var icons = { success: "fa-circle-check", danger: "fa-circle-xmark", warning: "fa-triangle-exclamation", info: "fa-circle-info" };
    toast.innerHTML = '<i class="fa-solid ' + (icons[type] || icons.info) + '"></i><span>' + message + "</span>";
    stack.appendChild(toast);
    setTimeout(function () {
      toast.style.transition = "opacity .3s, transform .3s";
      toast.style.opacity = "0";
      toast.style.transform = "translateX(40px)";
      setTimeout(function () { toast.remove(); }, 300);
    }, 3800);
  };

  document.addEventListener("DOMContentLoaded", function () {
    updateThemeIcon();

    // Convert server-rendered Django messages into toasts.
    document.querySelectorAll("[data-server-message]").forEach(function (el) {
      window.showToast(el.getAttribute("data-message"), el.getAttribute("data-level"));
    });

    // Image fallback to placeholder.
    document.querySelectorAll("img[data-fallback]").forEach(function (img) {
      img.addEventListener("error", function () {
        if (img.dataset.failed) return;
        img.dataset.failed = "1";
        img.src = img.getAttribute("data-fallback");
      });
    });

    // Reveal on scroll.
    var revealEls = document.querySelectorAll(".reveal");
    if ("IntersectionObserver" in window && revealEls.length) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
        });
      }, { threshold: 0.12 });
      revealEls.forEach(function (el) { io.observe(el); });
    } else {
      revealEls.forEach(function (el) { el.classList.add("in"); });
    }

    // Active nav link highlighting.
    var path = window.location.pathname;
    document.querySelectorAll(".navbar .nav-link").forEach(function (link) {
      var href = link.getAttribute("href");
      if (href && href !== "/" && path.indexOf(href) === 0) link.classList.add("active");
      if (href === "/" && path === "/") link.classList.add("active");
    });
  });
})();