"use strict";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const copy = {
  login: {
    badge: "Welcome back",
    title: "Sign in to Spendly",
    subtitle: "Enter your details to open your dashboard.",
  },
  register: {
    badge: "Get started",
    title: "Create your account",
    subtitle: "Start tracking expenses in less than a minute.",
  },
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  await loadBrand();
  try {
    const response = await fetch("/api/auth/me", { credentials: "same-origin" });
    if (response.ok) {
      window.location.href = "/";
      return;
    }
  } catch {
    // The sign-in page can still work if the session check fails.
  }

  bindEvents();
}

async function loadBrand() {
  try {
    const response = await fetch("/api/config");
    if (!response.ok) return;
    const config = await response.json();
    if (config.app_name) {
      document.title = `Sign in — ${config.app_name}`;
      $$(".brand-copy strong").forEach((element) => {
        element.textContent = config.app_name;
      });
    }
  } catch {
    // Keep the default branding.
  }
}

function bindEvents() {
  $("#showRegister").addEventListener("click", () => setMode("register"));
  $("#showLogin").addEventListener("click", () => setMode("login"));

  $$("[data-reveal]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.reveal);
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.textContent = show ? "Hide" : "Show";
      button.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  });

  $("#loginForm").addEventListener("submit", handleLogin);
  $("#registerForm").addEventListener("submit", handleRegister);

  $$(".auth-form input").forEach((input) => {
    input.addEventListener("input", () => {
      const error = input.closest("form").querySelector(".form-error");
      if (error) error.textContent = "";
    });
  });
}

function setMode(mode) {
  const isRegister = mode === "register";
  $("#loginForm").hidden = isRegister;
  $("#registerForm").hidden = !isRegister;
  $("#authSwitch").hidden = isRegister;
  $("#authSwitchBack").hidden = !isRegister;
  $("#authBadge").textContent = copy[mode].badge;
  $("#authTitle").textContent = copy[mode].title;
  $("#authSubtitle").textContent = copy[mode].subtitle;
  $("#loginError").textContent = "";
  $("#registerError").textContent = "";
  requestAnimationFrame(() => {
    (isRegister ? $("#registerName") : $("#loginEmail")).focus();
  });
}

async function handleLogin(event) {
  event.preventDefault();
  const button = $("#loginSubmit");
  const errorBox = $("#loginError");
  const email = $("#loginEmail").value.trim();
  const password = $("#loginPassword").value;
  errorBox.textContent = "";

  if (!email || !password) {
    errorBox.textContent = "Enter your email and password.";
    return;
  }

  setLoading(button, true, "Signing in…");
  try {
    await request("/api/auth/login", { email, password });
    window.location.href = "/";
  } catch (error) {
    errorBox.textContent = error.message;
  } finally {
    setLoading(button, false);
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const button = $("#registerSubmit");
  const errorBox = $("#registerError");
  const name = $("#registerName").value.trim();
  const email = $("#registerEmail").value.trim();
  const password = $("#registerPassword").value;
  const confirmPassword = $("#registerConfirm").value;
  errorBox.textContent = "";

  if (name.length < 2) {
    errorBox.textContent = "Enter your full name.";
    return;
  }
  if (!email) {
    errorBox.textContent = "Enter your email address.";
    return;
  }
  if (password.length < 8) {
    errorBox.textContent = "Use at least 8 characters for your password.";
    return;
  }
  if (password !== confirmPassword) {
    errorBox.textContent = "Passwords do not match.";
    return;
  }

  setLoading(button, true, "Creating account…");
  try {
    await request("/api/auth/register", {
      name,
      email,
      password,
      confirm_password: confirmPassword,
    });
    window.location.href = "/";
  } catch (error) {
    errorBox.textContent = error.message;
  } finally {
    setLoading(button, false);
  }
}

async function request(path, body) {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Something went wrong. Please try again.");
  }
  return data;
}

function setLoading(button, loading, loadingText) {
  if (loading) {
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}
