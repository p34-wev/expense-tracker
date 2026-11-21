"use strict";

/* --------------------------------------------------------------------------
   Helpers
   -------------------------------------------------------------------------- */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  config: { currency_code: "INR", currency_locale: "en-IN", app_name: "Spendly" },
  user: null,
  categories: [],
  budgets: [],
  dashboard: null,
  expenses: [],
  expensePagination: { page: 1, limit: 10, total: 0, total_pages: 1 },
  expenseFilters: {
    search: "",
    category_id: "",
    from: "",
    to: "",
    sort: "date_desc",
  },
  month: "",
  view: "overview",
  currencySymbol: "₹",
  chartPoints: [],
  confirmResolve: null,
  editingExpenseId: null,
  editingCategoryId: null,
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function currentMonth() {
  return todayISO().slice(0, 7);
}

function monthBounds(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(year, monthNumber - 1, 1);
  const end = new Date(year, monthNumber, 0);
  return { start: toISODate(start), end: toISODate(end) };
}

function toISODate(dateValue) {
  return `${dateValue.getFullYear()}-${pad(dateValue.getMonth() + 1)}-${pad(dateValue.getDate())}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(String(value || "")) ? value : "#64748b";
}

function money(value) {
  const number = Number(value) || 0;
  try {
    return new Intl.NumberFormat(state.config.currency_locale, {
      style: "currency",
      currency: state.config.currency_code,
      maximumFractionDigits: 2,
    }).format(number);
  } catch {
    return `₹${number.toFixed(2)}`;
  }
}

function compactMoney(value) {
  const number = Number(value) || 0;
  try {
    return new Intl.NumberFormat(state.config.currency_locale, {
      style: "currency",
      currency: state.config.currency_code,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(number);
  } catch {
    return `₹${Math.round(number)}`;
  }
}

function formatDate(value, options = { day: "numeric", month: "short", year: "numeric" }) {
  if (!value) return "—";
  const dateValue = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(dateValue.getTime())) return "—";
  return dateValue.toLocaleDateString(state.config.currency_locale, options);
}

function formatMonth(value) {
  if (!value) return "—";
  const [year, monthNumber] = value.split("-").map(Number);
  const dateValue = new Date(year, monthNumber - 1, 1);
  return dateValue.toLocaleDateString(state.config.currency_locale, {
    month: "long",
    year: "numeric",
  });
}

function formatMonthShort(value) {
  if (!value) return "—";
  const [year, monthNumber] = value.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString(
    state.config.currency_locale,
    { month: "short", year: "numeric" }
  );
}

function initials(name) {
  const parts = String(name || "?").trim().split(/\s+/);
  return (parts[0]?.[0] || "?").toUpperCase() + (parts[1]?.[0] || "").toUpperCase();
}

function debounce(callback, delay = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), delay);
  };
}

async function api(path, options = {}) {
  const requestOptions = { credentials: "same-origin", ...options };
  requestOptions.headers = { Accept: "application/json", ...(options.headers || {}) };

  if (options.body !== undefined && typeof options.body !== "string") {
    requestOptions.body = JSON.stringify(options.body);
    requestOptions.headers["Content-Type"] = "application/json";
  }

  const response = await fetch(path, requestOptions);
  const data = await response.json().catch(() => ({}));

  if (response.status === 401 && !path.startsWith("/api/auth/")) {
    window.location.href = "/login.html";
    const error = new Error("Please sign in again.");
    error.status = 401;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(data.message || "Something went wrong.");
    error.status = response.status;
    throw error;
  }

  return data;
}

function toast(message, type = "success") {
  const container = $("#toastContainer");
  if (!container) return;
  const element = document.createElement("div");
  element.className = `toast ${type}`;
  element.innerHTML = `<span class="toast-icon">${type === "error" ? "!" : "✓"}</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(element);
  setTimeout(() => {
    element.classList.add("hide");
    setTimeout(() => element.remove(), 220);
  }, 3600);
}

function setButtonLoading(button, loading, loadingText = "Saving…") {
  if (!button) return;
  if (loading) {
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

/* --------------------------------------------------------------------------
   Modal helpers
   -------------------------------------------------------------------------- */

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.hidden = true;
  if (!$$(".modal:not([hidden])").length) {
    document.body.classList.remove("modal-open");
  }
}

function showConfirm({
  title = "Are you sure?",
  message = "",
  confirmLabel = "Delete",
  danger = true,
} = {}) {
  $("#confirmTitle").textContent = title;
  $("#confirmMessage").textContent = message;
  const okButton = $("#confirmOk");
  okButton.textContent = confirmLabel;
  okButton.className = danger ? "btn btn-danger" : "btn btn-primary";
  $("#confirmIcon").textContent = danger ? "!" : "?";
  $("#confirmIcon").style.background = danger ? "var(--danger-soft)" : "var(--green-soft)";
  $("#confirmIcon").style.color = danger ? "var(--danger)" : "var(--accent-dark)";
  openModal("confirmModal");
  return new Promise((resolve) => {
    state.confirmResolve = resolve;
  });
}

function resolveConfirm(result) {
  const resolve = state.confirmResolve;
  state.confirmResolve = null;
  closeModal("confirmModal");
  if (resolve) resolve(result);
}

/* --------------------------------------------------------------------------
   Initialization
   -------------------------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    const config = await api("/api/config");
    state.config = { ...state.config, ...config };
    applyCurrency();

    const me = await api("/api/auth/me");
    state.user = me.user;
    renderUser();

    const categories = await api("/api/categories");
    state.categories = categories.data;

    setupEventListeners();
    populateCategorySelects();
    renderUser();
    renderGreeting();

    state.month = currentMonth();
    $("#monthPicker").value = state.month;
    $("#budgetMonth").value = state.month;
    setDefaultExpenseDates();

    await Promise.all([
      loadDashboard(),
      loadExpenses(1),
      loadCategories(),
      loadBudgets(),
    ]);

    const hash = window.location.hash.replace("#", "");
    const initialView = ["overview", "expenses", "categories", "budgets"].includes(hash)
      ? hash
      : "overview";
    switchView(initialView, { updateHash: false });
  } catch (error) {
    if (error.status !== 401) {
      toast(error.message || "Could not load the application.", "error");
    }
  }
}

function applyCurrency() {
  try {
    const parts = new Intl.NumberFormat(state.config.currency_locale, {
      style: "currency",
      currency: state.config.currency_code,
    }).formatToParts(0);
    state.currencySymbol = parts.find((part) => part.type === "currency")?.value || "₹";
  } catch {
    state.currencySymbol = "₹";
  }
  $$(".currency-prefix").forEach((element) => {
    element.textContent = state.currencySymbol;
  });
  if (state.config.app_name) {
    $("#brandName").textContent = state.config.app_name;
  }
}

function renderUser() {
  if (!state.user) return;
  $("#userName").textContent = state.user.name;
  $("#userEmail").textContent = state.user.email;
  $("#userAvatar").textContent = initials(state.user.name);
  $("#greetingName").textContent = state.user.name.split(/\s+/)[0];
}

function renderGreeting() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  $("#overviewTitle").innerHTML = `${greeting}, <span id="greetingName">${escapeHtml(
    state.user?.name.split(/\s+/)[0] || "there"
  )}</span> 👋`;
}

function setDefaultExpenseDates() {
  const bounds = monthBounds(state.month);
  $("#filterFrom").value = bounds.start;
  $("#filterTo").value = bounds.end;
  state.expenseFilters.from = bounds.start;
  state.expenseFilters.to = bounds.end;
}

/* --------------------------------------------------------------------------
   Event listeners
   -------------------------------------------------------------------------- */

function setupEventListeners() {
  document.addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) {
      event.preventDefault();
      switchView(viewButton.dataset.view);
      return;
    }

    if (event.target.closest("[data-add-expense]")) {
      openExpenseModal();
      return;
    }

    if (event.target.closest("[data-close-expense]")) {
      closeModal("expenseModal");
      return;
    }
    if (event.target.closest("[data-close-category]")) {
      closeModal("categoryModal");
      return;
    }
    if (event.target.closest("[data-confirm-cancel]")) {
      resolveConfirm(false);
      return;
    }
  });

  $("#logoutBtn").addEventListener("click", async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login.html";
    }
  });

  $("#menuBtn").addEventListener("click", () => {
    $("#sidebar").classList.add("open");
    $("#mobileOverlay").classList.add("open");
  });

  $("#mobileOverlay").addEventListener("click", closeSidebar);

  $("#monthPicker").addEventListener("change", async (event) => {
    if (!event.target.value) return;
    state.month = event.target.value;
    $("#budgetMonth").value = state.month;
    await Promise.all([loadDashboard(), loadBudgets()]);
    if (state.view === "budgets") renderBudgetStatus();
  });

  $("#budgetMonth").addEventListener("change", async (event) => {
    if (!event.target.value) return;
    state.month = event.target.value;
    $("#monthPicker").value = state.month;
    await Promise.all([loadDashboard(), loadBudgets()]);
  });

  $("#expenseForm").addEventListener("submit", handleExpenseSubmit);
  $("#categoryForm").addEventListener("submit", handleCategorySubmit);
  $("#budgetForm").addEventListener("submit", handleBudgetSubmit);
  $("#filtersForm").addEventListener("submit", (event) => {
    event.preventDefault();
    syncExpenseFilters();
    loadExpenses(1);
  });

  const searchInput = $("#searchInput");
  searchInput.addEventListener(
    "input",
    debounce(() => {
      syncExpenseFilters();
      loadExpenses(1);
    }, 300)
  );

  ["#filterCategory", "#filterFrom", "#filterTo", "#filterSort"].forEach((selector) => {
    $(selector).addEventListener("change", () => {
      syncExpenseFilters();
      loadExpenses(1);
    });
  });

  $("#clearFilters").addEventListener("click", () => {
    $("#searchInput").value = "";
    $("#filterCategory").value = "";
    $("#filterFrom").value = "";
    $("#filterTo").value = "";
    $("#filterSort").value = "date_desc";
    state.expenseFilters = {
      search: "",
      category_id: "",
      from: "",
      to: "",
      sort: "date_desc",
    };
    loadExpenses(1);
  });

  $("#expensesBody").addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-expense]");
    if (editButton) {
      const expense = findExpense(Number(editButton.dataset.editExpense));
      if (expense) openExpenseModal(expense);
      return;
    }
    const deleteButton = event.target.closest("[data-delete-expense]");
    if (deleteButton) deleteExpense(Number(deleteButton.dataset.deleteExpense));
  });

  $("#recentList").addEventListener("click", (event) => {
    const row = event.target.closest("[data-edit-expense]");
    if (!row) return;
    const expense = findExpense(Number(row.dataset.editExpense));
    if (expense) openExpenseModal(expense);
  });

  $("#pagination").addEventListener("click", (event) => {
    const button = event.target.closest("[data-page]");
    if (!button || button.disabled) return;
    loadExpenses(Number(button.dataset.page));
  });

  $("#categoriesGrid").addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-category]");
    if (editButton) {
      const category = state.categories.find(
        (item) => item.id === Number(editButton.dataset.editCategory)
      );
      if (category) openCategoryModal(category);
      return;
    }
    const deleteButton = event.target.closest("[data-delete-category]");
    if (deleteButton) deleteCategory(Number(deleteButton.dataset.deleteCategory));
  });

  $("#addCategoryBtn").addEventListener("click", () => openCategoryModal());

  $("#categoryColor").addEventListener("input", (event) => {
    $("#categoryColorValue").textContent = event.target.value;
  });

  $("#emojiRow").addEventListener("click", (event) => {
    const button = event.target.closest("[data-emoji]");
    if (button) $("#categoryIcon").value = button.dataset.emoji;
  });

  $("#confirmOk").addEventListener("click", () => resolveConfirm(true));

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (state.confirmResolve) {
      resolveConfirm(false);
      return;
    }
    if (!$("#expenseModal").hidden) closeModal("expenseModal");
    else if (!$("#categoryModal").hidden) closeModal("categoryModal");
    else closeSidebar();
  });

  const chartCanvas = $("#trendChart");
  chartCanvas.addEventListener("mousemove", handleChartHover);
  chartCanvas.addEventListener("mouseleave", () => {
    $("#chartTooltip").hidden = true;
  });

  window.addEventListener(
    "resize",
    debounce(() => {
      if (state.view === "overview") drawTrendChart();
    }, 160)
  );
}

function closeSidebar() {
  $("#sidebar").classList.remove("open");
  $("#mobileOverlay").classList.remove("open");
}

function switchView(view, { updateHash = true } = {}) {
  if (!["overview", "expenses", "categories", "budgets"].includes(view)) return;
  state.view = view;

  $$(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === view);
  });
  $$(".view").forEach((section) => {
    section.classList.toggle("active", section.id === `view-${view}`);
  });

  const titles = {
    overview: ["Overview", "Dashboard"],
    expenses: ["Expenses", "Transactions"],
    categories: ["Categories", "Organize"],
    budgets: ["Budgets", "Planning"],
  };
  $("#pageTitle").textContent = titles[view][0];
  $("#pageEyebrow").textContent = titles[view][1];
  $("#monthControl").hidden = view === "expenses" || view === "categories";

  if (updateHash) {
    history.replaceState(null, "", `#${view}`);
  }

  closeSidebar();

  if (view === "overview") {
    requestAnimationFrame(drawTrendChart);
  }
  if (view === "expenses") loadExpenses(state.expensePagination.page || 1);
  if (view === "categories") loadCategories();
  if (view === "budgets") {
    loadBudgets().then(() => renderBudgetStatus());
  }
}

/* --------------------------------------------------------------------------
   Dashboard
   -------------------------------------------------------------------------- */

async function loadDashboard() {
  try {
    const data = await api(`/api/dashboard?month=${encodeURIComponent(state.month)}`);
    state.dashboard = data;
    renderDashboard();
  } catch (error) {
    if (error.status !== 401) toast(error.message, "error");
  }
}

function renderDashboard() {
  const data = state.dashboard;
  if (!data) return;
  const stats = data.stats;
  const monthName = formatMonth(data.month);

  $("#monthBadge").textContent = monthName;
  $("#chartMonthLabel").textContent = monthName;

  $("#statSpent").textContent = money(stats.total_spent);
  $("#statCount").textContent = String(stats.transaction_count);
  $("#statAverage").textContent = money(stats.average_expense);

  const meta = $("#statSpentMeta");
  meta.className = "stat-chip";
  if (stats.change_percent === null) {
    meta.textContent = "No prior data";
    meta.classList.add("neutral");
  } else if (stats.change_percent > 0) {
    meta.textContent = `↑ ${Math.abs(stats.change_percent)}%`;
    meta.classList.add("is-up");
  } else if (stats.change_percent < 0) {
    meta.textContent = `↓ ${Math.abs(stats.change_percent)}%`;
    meta.classList.add("is-down");
  } else {
    meta.textContent = "Same as last month";
    meta.classList.add("neutral");
  }

  $("#statSpentFoot").textContent =
    stats.previous_total > 0
      ? `vs ${money(stats.previous_total)} last month`
      : "Across all categories";
  $("#statCountFoot").textContent = `${monthName} transactions`;
  $("#statAverageFoot").textContent =
    stats.transaction_count > 0
      ? `Based on ${stats.transaction_count} transaction${stats.transaction_count === 1 ? "" : "s"}`
      : "No transactions yet";

  if (stats.budget > 0) {
    $("#statBudget").textContent = money(stats.remaining);
    $("#statBudgetChip").textContent = `${Math.round(stats.budget_used_percent)}% used`;
    $("#statBudgetBar").style.width = `${Math.min(100, Math.max(0, stats.budget_used_percent))}%`;
    $("#statBudgetBar").style.background =
      stats.remaining < 0
        ? "linear-gradient(90deg, #f87171, #ef4444)"
        : "linear-gradient(90deg, #34d399, #10b981)";
  } else {
    $("#statBudget").textContent = "Not set";
    $("#statBudgetChip").textContent = "Set a budget";
    $("#statBudgetBar").style.width = "0%";
  }

  renderSidebarBudget(stats);
  renderRecent(data.recent);
  renderCategoryBreakdown(data.by_category, stats.total_spent);
  renderBudgetOverview(stats);
  renderBudgetBars(data.monthly_trend);
  renderBudgetStatus();
  drawTrendChart();
}

function renderSidebarBudget(stats) {
  if (stats.budget > 0) {
    $("#sidebarBudgetAmount").textContent = money(stats.remaining);
    $("#sidebarBudgetBar").style.width = `${Math.min(100, Math.max(0, stats.budget_used_percent))}%`;
    $("#sidebarBudgetBar").style.background =
      stats.remaining < 0
        ? "linear-gradient(90deg, #f87171, #ef4444)"
        : "linear-gradient(90deg, #34d399, #6ee7b7)";
    $("#sidebarBudgetNote").textContent =
      stats.remaining < 0
        ? `Over budget by ${money(Math.abs(stats.remaining))}.`
        : `${Math.round(stats.budget_used_percent)}% of ${money(stats.budget)} used.`;
  } else {
    $("#sidebarBudgetAmount").textContent = "Not set";
    $("#sidebarBudgetBar").style.width = "0%";
    $("#sidebarBudgetNote").textContent = "Set a limit to keep spending on track.";
  }
}

function renderRecent(recent) {
  const list = $("#recentList");
  list.innerHTML = recent
    .map(
      (expense) => `
        <div class="recent-row" data-edit-expense="${expense.id}" title="Edit expense">
          <span class="recent-icon" style="background:${safeColor(expense.category_color)}1f">${escapeHtml(expense.category_icon)}</span>
          <span class="recent-copy">
            <strong>${escapeHtml(expense.title)}</strong>
            <small>${escapeHtml(expense.category_name)} · ${formatDate(expense.expense_date)}</small>
          </span>
          <span class="recent-amount">${money(expense.amount)}</span>
        </div>
      `
    )
    .join("");
  $("#recentEmpty").hidden = recent.length > 0;
  list.hidden = recent.length === 0;
}

function renderCategoryBreakdown(categories, totalSpent) {
  const withSpending = categories.filter((category) => Number(category.total) > 0);
  const legend = $("#categoryLegend");
  const donut = $("#categoryDonut");
  const empty = $("#categoryEmpty");

  if (!withSpending.length) {
    donut.style.background = "conic-gradient(#e8eef7 0 100%)";
    $("#donutTotal").textContent = money(0);
    legend.innerHTML = "";
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  const display = withSpending.slice(0, 6);
  if (withSpending.length > 6) {
    const rest = withSpending.slice(6);
    display.push({
      name: "Other categories",
      color: "#94a3b8",
      icon: "•",
      total: rest.reduce((sum, category) => sum + Number(category.total), 0),
    });
  }

  const total = display.reduce((sum, category) => sum + Number(category.total), 0);
  let cursor = 0;
  const stops = display.map((category) => {
    const start = cursor;
    cursor += (Number(category.total) / total) * 100;
    return `${safeColor(category.color)} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
  });
  donut.style.background = `conic-gradient(${stops.join(", ")})`;
  $("#donutTotal").textContent = money(totalSpent);

  legend.innerHTML = display
    .map((category) => {
      const percent = total > 0 ? (Number(category.total) / total) * 100 : 0;
      return `
        <div class="legend-row">
          <span class="legend-dot" style="background:${safeColor(category.color)}"></span>
          <span class="legend-name">${escapeHtml(category.name)}</span>
          <span class="legend-value">${percent.toFixed(0)}%</span>
        </div>
      `;
    })
    .join("");
}

function renderBudgetOverview(stats) {
  const content = $("#overviewBudgetContent");
  const empty = $("#overviewBudgetEmpty");
  if (stats.budget > 0) {
    content.hidden = false;
    empty.hidden = true;
    const percent = Math.max(0, Math.min(100, stats.budget_used_percent));
    const ring = $("#overviewBudgetRing");
    ring.style.background = `conic-gradient(${
      stats.remaining < 0 ? "#ef4444" : "#10b981"
    } ${percent}%, #e8eef7 0)`;
    $("#overviewBudgetPercent").textContent = `${Math.round(stats.budget_used_percent)}%`;
    $("#overviewBudgetSpent").textContent = money(stats.total_spent);
    $("#overviewBudgetRemaining").textContent =
      stats.remaining < 0
        ? `Over by ${money(Math.abs(stats.remaining))}`
        : `${money(stats.remaining)} left`;
    const progress = $("#overviewBudgetProgress");
    progress.style.width = `${percent}%`;
    progress.parentElement.classList.toggle("over", stats.remaining < 0);
    $("#overviewBudgetAmount").textContent = money(stats.budget);
    $("#overviewBudgetNote").textContent =
      stats.remaining < 0 ? "Over budget" : `${Math.round(percent)}% used`;
  } else {
    content.hidden = true;
    empty.hidden = false;
  }
}

function renderBudgetBars(monthlyTrend) {
  const container = $("#budgetBars");
  const empty = $("#budgetBarsEmpty");
  if (!monthlyTrend || !monthlyTrend.length) {
    container.innerHTML = "";
    empty.hidden = false;
    return;
  }
  const max = Math.max(...monthlyTrend.map((item) => Number(item.total)), 1);
  const hasSpending = monthlyTrend.some((item) => Number(item.total) > 0);
  container.innerHTML = monthlyTrend
    .map((item) => {
      const height = (Number(item.total) / max) * 100;
      const isCurrent = item.month === state.month;
      return `
        <div class="bar-column ${isCurrent ? "is-current" : ""}" title="${escapeHtml(
          `${formatMonthShort(item.month)}: ${money(item.total)}`
        )}">
          <span class="bar-value">${compactMoney(item.total)}</span>
          <div class="bar-track"><span class="bar-fill" style="height:${Math.max(
            Number(item.total) > 0 ? 3 : 0,
            height
          )}%"></span></div>
          <span class="bar-label">${escapeHtml(item.label)}</span>
        </div>
      `;
    })
    .join("");
  empty.hidden = hasSpending;
  container.hidden = !hasSpending;
}

/* --------------------------------------------------------------------------
   Chart
   -------------------------------------------------------------------------- */

function drawTrendChart() {
  const canvas = $("#trendChart");
  const wrap = $("#chartWrap");
  if (!canvas || !wrap || !state.dashboard) return;
  const rect = wrap.getBoundingClientRect();
  if (rect.width < 20 || rect.height < 20) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  const context = canvas.getContext("2d");
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, rect.width, rect.height);

  const daily = state.dashboard.daily || [];
  const values = daily.map((item) => Number(item.total) || 0);
  const maxValue = Math.max(...values, 0);
  const hasSpending = maxValue > 0;
  $("#chartEmpty").hidden = hasSpending;

  const padding = { top: 18, right: 14, bottom: 30, left: 55 };
  const width = rect.width - padding.left - padding.right;
  const height = rect.height - padding.top - padding.bottom;
  const niceMax = getNiceMax(maxValue || 1);
  const steps = 4;

  context.font = "11px 'DM Sans', system-ui, sans-serif";
  context.textBaseline = "middle";

  for (let index = 0; index <= steps; index += 1) {
    const y = padding.top + (height / steps) * index;
    const value = niceMax - (niceMax / steps) * index;
    context.beginPath();
    context.strokeStyle = index === steps ? "#dbe3ee" : "#edf1f7";
    context.lineWidth = 1;
    context.moveTo(padding.left, y);
    context.lineTo(padding.left + width, y);
    context.stroke();
    context.fillStyle = "#94a3b8";
    context.textAlign = "right";
    context.fillText(compactMoney(value), padding.left - 9, y);
  }

  const pointCount = daily.length;
  const points = daily.map((item, index) => {
    const x = padding.left + (pointCount <= 1 ? width / 2 : (width / (pointCount - 1)) * index);
    const y = padding.top + height - (Number(item.total) / niceMax) * height;
    return { x, y, total: Number(item.total), day: item.day, date: item.date };
  });
  state.chartPoints = points;

  if (!hasSpending) {
    return;
  }

  const gradient = context.createLinearGradient(0, padding.top, 0, padding.top + height);
  gradient.addColorStop(0, "rgba(16, 185, 129, .22)");
  gradient.addColorStop(0.7, "rgba(16, 185, 129, .05)");
  gradient.addColorStop(1, "rgba(16, 185, 129, 0)");

  context.beginPath();
  context.moveTo(points[0].x, padding.top + height);
  points.forEach((point) => context.lineTo(point.x, point.y));
  context.lineTo(points[points.length - 1].x, padding.top + height);
  context.closePath();
  context.fillStyle = gradient;
  context.fill();

  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.strokeStyle = "#10b981";
  context.lineWidth = 2.4;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.stroke();

  points.forEach((point) => {
    if (point.total > 0) {
      context.beginPath();
      context.arc(point.x, point.y, 2.7, 0, Math.PI * 2);
      context.fillStyle = "#ffffff";
      context.fill();
      context.lineWidth = 1.8;
      context.strokeStyle = "#10b981";
      context.stroke();
    }
  });

  const labelIndexes = new Set([0, 6, 13, 20, pointCount - 1]);
  context.fillStyle = "#94a3b8";
  context.textAlign = "center";
  context.textBaseline = "top";
  labelIndexes.forEach((index) => {
    if (index < 0 || index >= points.length) return;
    context.fillText(String(points[index].day), points[index].x, padding.top + height + 10);
  });
}

function getNiceMax(value) {
  const roughStep = Math.max(value, 1) / 4;
  const power = 10 ** Math.floor(Math.log10(roughStep));
  const candidates = [1, 2, 2.5, 5, 10];
  const step = candidates.find((candidate) => candidate * power >= roughStep) * power;
  return step * 4;
}

function handleChartHover(event) {
  const canvas = $("#trendChart");
  const tooltip = $("#chartTooltip");
  if (!state.chartPoints.length) return;

  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const nearest = state.chartPoints.reduce((best, point) =>
    Math.abs(point.x - x) < Math.abs(best.x - x) ? point : best
  );

  if (Math.abs(nearest.x - x) > 34) {
    tooltip.hidden = true;
    return;
  }

  tooltip.hidden = false;
  tooltip.style.left = `${nearest.x}px`;
  tooltip.style.top = `${nearest.y}px`;
  tooltip.innerHTML = `<strong>${money(nearest.total)}</strong><br>${formatDate(nearest.date, {
    day: "numeric",
    month: "short",
  })}`;
}

/* --------------------------------------------------------------------------
   Expenses
   -------------------------------------------------------------------------- */

function syncExpenseFilters() {
  state.expenseFilters = {
    search: $("#searchInput").value.trim(),
    category_id: $("#filterCategory").value,
    from: $("#filterFrom").value,
    to: $("#filterTo").value,
    sort: $("#filterSort").value,
  };
}

async function loadExpenses(page = 1) {
  try {
    const params = new URLSearchParams({
      page: String(page),
      limit: "10",
      sort: state.expenseFilters.sort || "date_desc",
    });
    if (state.expenseFilters.search) params.set("search", state.expenseFilters.search);
    if (state.expenseFilters.category_id) {
      params.set("category_id", state.expenseFilters.category_id);
    }
    if (state.expenseFilters.from) params.set("from", state.expenseFilters.from);
    if (state.expenseFilters.to) params.set("to", state.expenseFilters.to);

    const data = await api(`/api/expenses?${params.toString()}`);
    state.expenses = data.data;
    state.expensePagination = data.pagination;
    renderExpenses(data);
  } catch (error) {
    if (error.status !== 401) toast(error.message, "error");
  }
}

function renderExpenses(data) {
  const body = $("#expensesBody");
  const rows = data.data;
  body.innerHTML = rows
    .map(
      (expense) => `
        <tr>
          <td>
            <div class="expense-cell">
              <span class="expense-icon" style="background:${safeColor(expense.category_color)}1f">${escapeHtml(expense.category_icon)}</span>
              <span class="expense-copy">
                <strong>${escapeHtml(expense.title)}</strong>
                ${expense.notes ? `<small>${escapeHtml(expense.notes)}</small>` : ""}
              </span>
            </div>
          </td>
          <td>
            <span class="category-pill"><i style="background:${safeColor(expense.category_color)}"></i>${escapeHtml(expense.category_name)}</span>
          </td>
          <td>${formatDate(expense.expense_date)}</td>
          <td><span class="payment-pill">${escapeHtml(expense.payment_method)}</span></td>
          <td class="align-right amount-cell">${money(expense.amount)}</td>
          <td>
            <div class="row-actions">
              <button class="row-action" type="button" data-edit-expense="${expense.id}" title="Edit expense" aria-label="Edit expense">
                <svg viewBox="0 0 24 24" fill="none"><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m13.5 6.5 3 3" stroke="currentColor" stroke-width="1.7"/></svg>
              </button>
              <button class="row-action danger" type="button" data-delete-expense="${expense.id}" title="Delete expense" aria-label="Delete expense">
                <svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `
    )
    .join("");

  const total = data.pagination.total;
  const start = total ? (data.pagination.page - 1) * data.pagination.limit + 1 : 0;
  const end = Math.min(total, data.pagination.page * data.pagination.limit);
  $("#expenseSummary").textContent = total
    ? `Showing ${start}–${end} of ${total} expense${total === 1 ? "" : "s"} · ${money(
        data.summary.total_amount
      )} total`
    : "No expenses match these filters.";
  $("#expensesEmpty").hidden = total > 0;
  renderPagination(data.pagination);
}

function renderPagination(pagination) {
  const container = $("#pagination");
  if (pagination.total_pages <= 1) {
    container.innerHTML = "";
    return;
  }

  const current = pagination.page;
  const totalPages = pagination.total_pages;
  const pages = new Set([1, totalPages, current - 1, current, current + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);

  let html = `<button class="page-btn" type="button" data-page="${current - 1}" ${
    current === 1 ? "disabled" : ""
  } aria-label="Previous page">‹</button>`;

  let previous = 0;
  sorted.forEach((page) => {
    if (previous && page - previous > 1) {
      html += `<span class="page-btn" aria-hidden="true" style="border:0;background:none">…</span>`;
    }
    html += `<button class="page-btn ${page === current ? "active" : ""}" type="button" data-page="${page}" ${
      page === current ? 'aria-current="page"' : ""
    }>${page}</button>`;
    previous = page;
  });

  html += `<button class="page-btn" type="button" data-page="${current + 1}" ${
    current === totalPages ? "disabled" : ""
  } aria-label="Next page">›</button>`;
  container.innerHTML = html;
}

function findExpense(id) {
  return (
    state.expenses.find((expense) => expense.id === id) ||
    state.dashboard?.recent?.find((expense) => expense.id === id) ||
    null
  );
}

function openExpenseModal(expense = null) {
  if (!state.categories.length) {
    toast("Create a category before adding an expense.", "error");
    switchView("categories");
    return;
  }

  state.editingExpenseId = expense?.id || null;
  const form = $("#expenseForm");
  form.reset();
  $("#expenseFormError").textContent = "";
  $("#expenseModalTitle").textContent = expense ? "Edit expense" : "Add expense";
  $("#expenseSubmit").textContent = expense ? "Save changes" : "Save expense";

  fillExpenseCategorySelect(expense?.category_id);
  $("#expenseTitle").value = expense?.title || "";
  $("#expenseAmount").value = expense ? Number(expense.amount) : "";
  $("#expenseDate").value = expense?.expense_date?.slice(0, 10) || todayISO();
  $("#expensePayment").value = expense?.payment_method || "Cash";
  $("#expenseNotes").value = expense?.notes || "";

  openModal("expenseModal");
  requestAnimationFrame(() => $("#expenseTitle").focus());
}

function fillExpenseCategorySelect(selectedId) {
  const select = $("#expenseCategory");
  select.innerHTML = state.categories
    .map(
      (category) =>
        `<option value="${category.id}" ${
          Number(selectedId) === category.id ? "selected" : ""
        }>${escapeHtml(category.icon)} ${escapeHtml(category.name)}</option>`
    )
    .join("");
}

async function handleExpenseSubmit(event) {
  event.preventDefault();
  const button = $("#expenseSubmit");
  const errorBox = $("#expenseFormError");
  errorBox.textContent = "";

  const title = $("#expenseTitle").value.trim();
  const amount = Number($("#expenseAmount").value);
  const categoryId = Number($("#expenseCategory").value);
  const date = $("#expenseDate").value;

  if (!title) {
    errorBox.textContent = "Enter an expense title.";
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    errorBox.textContent = "Enter an amount greater than zero.";
    return;
  }
  if (!categoryId) {
    errorBox.textContent = "Choose a category.";
    return;
  }
  if (!date) {
    errorBox.textContent = "Choose a date.";
    return;
  }

  const payload = {
    title,
    amount,
    category_id: categoryId,
    expense_date: date,
    payment_method: $("#expensePayment").value,
    notes: $("#expenseNotes").value.trim(),
  };

  setButtonLoading(button, true, state.editingExpenseId ? "Saving…" : "Adding…");
  try {
    if (state.editingExpenseId) {
      await api(`/api/expenses/${state.editingExpenseId}`, {
        method: "PUT",
        body: payload,
      });
      toast("Expense updated.");
    } else {
      await api("/api/expenses", { method: "POST", body: payload });
      toast("Expense added.");
    }
    closeModal("expenseModal");
    state.editingExpenseId = null;
    await refreshMoneyViews();
  } catch (error) {
    if (error.status !== 401) errorBox.textContent = error.message;
  } finally {
    setButtonLoading(button, false);
  }
}

async function deleteExpense(id) {
  const expense = findExpense(id);
  if (!expense) return;
  const confirmed = await showConfirm({
    title: "Delete this expense?",
    message: `“${expense.title}” (${money(expense.amount)}) will be permanently removed.`,
    confirmLabel: "Delete expense",
  });
  if (!confirmed) return;

  try {
    await api(`/api/expenses/${id}`, { method: "DELETE" });
    toast("Expense deleted.");
    const remaining = Math.max(0, state.expensePagination.total - 1);
    const targetPage = Math.min(
      state.expensePagination.page,
      Math.max(1, Math.ceil(remaining / state.expensePagination.limit))
    );
    await refreshMoneyViews(targetPage);
  } catch (error) {
    if (error.status !== 401) toast(error.message, "error");
  }
}

async function refreshMoneyViews(expensePage = state.expensePagination.page || 1) {
  await Promise.all([
    loadDashboard(),
    loadExpenses(expensePage),
    loadCategories(),
    loadBudgets(),
  ]);
}

/* --------------------------------------------------------------------------
   Categories
   -------------------------------------------------------------------------- */

async function loadCategories() {
  try {
    const data = await api("/api/categories");
    state.categories = data.data;
    populateCategorySelects();
    renderCategories();
  } catch (error) {
    if (error.status !== 401) toast(error.message, "error");
  }
}

function populateCategorySelects() {
  const filter = $("#filterCategory");
  const currentFilter = filter.value;
  filter.innerHTML =
    '<option value="">All categories</option>' +
    state.categories
      .map(
        (category) =>
          `<option value="${category.id}">${escapeHtml(category.icon)} ${escapeHtml(
            category.name
          )}</option>`
      )
      .join("");
  filter.value = state.categories.some((category) => String(category.id) === currentFilter)
    ? currentFilter
    : "";

  const expenseSelect = $("#expenseCategory");
  if (expenseSelect) {
    const currentExpense = expenseSelect.value;
    fillExpenseCategorySelect(currentExpense ? Number(currentExpense) : undefined);
  }
}

function renderCategories() {
  const grid = $("#categoriesGrid");
  const maxTotal = Math.max(...state.categories.map((category) => Number(category.total_spent)), 1);

  grid.innerHTML = state.categories
    .map((category) => {
      const total = Number(category.total_spent) || 0;
      const width = Math.max(total > 0 ? 3 : 0, (total / maxTotal) * 100);
      return `
        <article class="category-tile" style="--tile-color:${safeColor(category.color)}">
          <div class="category-tile-top">
            <span class="category-tile-icon">${escapeHtml(category.icon)}</span>
            <span class="category-tile-actions">
              <button class="row-action" type="button" data-edit-category="${category.id}" title="Edit category" aria-label="Edit category">
                <svg viewBox="0 0 24 24" fill="none"><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m13.5 6.5 3 3" stroke="currentColor" stroke-width="1.7"/></svg>
              </button>
              <button class="row-action danger" type="button" data-delete-category="${category.id}" title="Delete category" aria-label="Delete category">
                <svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
            </span>
          </div>
          <h3>${escapeHtml(category.name)}</h3>
          <p class="category-total">${money(total)}</p>
          <div class="category-bar"><span style="width:${width}%"></span></div>
          <div class="category-meta">
            <span>${Number(category.expense_count)} expense${Number(category.expense_count) === 1 ? "" : "s"}</span>
            <span>all time</span>
          </div>
        </article>
      `;
    })
    .join("");
  $("#categoriesEmpty").hidden = state.categories.length > 0;
  grid.hidden = state.categories.length === 0;
}

function openCategoryModal(category = null) {
  state.editingCategoryId = category?.id || null;
  $("#categoryForm").reset();
  $("#categoryFormError").textContent = "";
  $("#categoryModalTitle").textContent = category ? "Edit category" : "New category";
  $("#categorySubmit").textContent = category ? "Save changes" : "Save category";
  $("#categoryName").value = category?.name || "";
  $("#categoryColor").value = category?.color || "#6366f1";
  $("#categoryColorValue").textContent = category?.color || "#6366f1";
  $("#categoryIcon").value = category?.icon || "📦";
  openModal("categoryModal");
  requestAnimationFrame(() => $("#categoryName").focus());
}

async function handleCategorySubmit(event) {
  event.preventDefault();
  const button = $("#categorySubmit");
  const errorBox = $("#categoryFormError");
  errorBox.textContent = "";

  const name = $("#categoryName").value.trim();
  const color = $("#categoryColor").value;
  const icon = $("#categoryIcon").value.trim() || "📦";
  if (!name) {
    errorBox.textContent = "Enter a category name.";
    return;
  }

  setButtonLoading(button, true, state.editingCategoryId ? "Saving…" : "Creating…");
  try {
    if (state.editingCategoryId) {
      await api(`/api/categories/${state.editingCategoryId}`, {
        method: "PUT",
        body: { name, color, icon },
      });
      toast("Category updated.");
    } else {
      await api("/api/categories", { method: "POST", body: { name, color, icon } });
      toast("Category created.");
    }
    closeModal("categoryModal");
    state.editingCategoryId = null;
    await refreshMoneyViews();
  } catch (error) {
    if (error.status !== 401) errorBox.textContent = error.message;
  } finally {
    setButtonLoading(button, false);
  }
}

async function deleteCategory(id) {
  const category = state.categories.find((item) => item.id === id);
  if (!category) return;
  const confirmed = await showConfirm({
    title: "Delete this category?",
    message: `“${category.name}” will be removed. Categories with expenses cannot be deleted.`,
    confirmLabel: "Delete category",
  });
  if (!confirmed) return;

  try {
    await api(`/api/categories/${id}`, { method: "DELETE" });
    toast("Category deleted.");
    await refreshMoneyViews();
  } catch (error) {
    if (error.status !== 401) toast(error.message, "error");
  }
}

/* --------------------------------------------------------------------------
   Budgets
   -------------------------------------------------------------------------- */

async function loadBudgets() {
  try {
    const data = await api("/api/budgets");
    state.budgets = data.data;
    renderBudgetHistory();

    const row = state.budgets.find((budget) => budget.month === $("#budgetMonth").value);
    if (document.activeElement !== $("#budgetAmount")) {
      $("#budgetAmount").value = row && Number(row.amount) > 0 ? Number(row.amount) : "";
    }
    renderBudgetStatus();
  } catch (error) {
    if (error.status !== 401) toast(error.message, "error");
  }
}

function renderBudgetHistory() {
  const body = $("#budgetHistoryBody");
  body.innerHTML = state.budgets
    .map(
      (budget) => `
        <tr>
          <td>${escapeHtml(formatMonthShort(budget.month))}</td>
          <td>${money(budget.amount)}</td>
          <td>${money(budget.spent)}</td>
          <td class="align-right">
            <span class="percent-badge ${budget.percent > 100 ? "over" : ""}">${Math.round(
              budget.percent
            )}%</span>
          </td>
        </tr>
      `
    )
    .join("");
  $("#budgetHistoryEmpty").hidden = state.budgets.length > 0;
  body.closest(".table-wrap").hidden = state.budgets.length === 0;
}

function renderBudgetStatus() {
  if (!state.dashboard) return;
  const stats = state.dashboard.stats;
  const month = $("#budgetMonth").value || state.month;
  $("#budgetSelectedLabel").textContent = formatMonth(month);

  const ring = $("#budgetRing");
  const percent = Math.max(0, Math.min(100, stats.budget_used_percent));
  ring.style.background = `conic-gradient(${
    stats.remaining !== null && stats.remaining < 0 ? "#ef4444" : "#10b981"
  } ${percent}%, #e8eef7 0)`;
  $("#budgetPercent").textContent = `${Math.round(stats.budget_used_percent)}%`;
  $("#budgetTotal").textContent = stats.budget > 0 ? money(stats.budget) : "Not set";
  $("#budgetSpent").textContent = money(stats.total_spent);
  $("#budgetRemaining").textContent =
    stats.budget > 0
      ? stats.remaining < 0
        ? `−${money(Math.abs(stats.remaining))}`
        : money(stats.remaining)
      : "—";

  if (stats.budget <= 0) {
    $("#budgetHint").textContent = "Set a budget for this month to see your progress.";
  } else if (stats.remaining < 0) {
    $("#budgetHint").textContent = `You are ${money(
      Math.abs(stats.remaining)
    )} over budget. Consider slowing down for the rest of the month.`;
  } else {
    const daysLeft = Math.max(
      0,
      Math.ceil(
        (new Date(
          Number(month.slice(0, 4)),
          Number(month.slice(5, 7)),
          0
        ) -
          new Date()) /
          86400000
      )
    );
    $("#budgetHint").textContent = `${money(stats.remaining)} left for ${
      daysLeft > 0 ? `the next ${daysLeft} day${daysLeft === 1 ? "" : "s"}` : "this month"
    }.`;
  }
}

async function handleBudgetSubmit(event) {
  event.preventDefault();
  const button = $("#budgetForm").querySelector('button[type="submit"]');
  const errorBox = $("#budgetFormError");
  errorBox.textContent = "";
  const month = $("#budgetMonth").value;
  const amount = Number($("#budgetAmount").value);

  if (!month) {
    errorBox.textContent = "Choose a month.";
    return;
  }
  if (!Number.isFinite(amount) || amount < 0) {
    errorBox.textContent = "Enter a budget of zero or more.";
    return;
  }

  setButtonLoading(button, true, "Saving…");
  try {
    await api("/api/budget", { method: "PUT", body: { month, amount } });
    state.month = month;
    $("#monthPicker").value = month;
    toast("Budget saved.");
    await Promise.all([loadBudgets(), loadDashboard()]);
    renderBudgetStatus();
  } catch (error) {
    if (error.status !== 401) errorBox.textContent = error.message;
  } finally {
    setButtonLoading(button, false);
  }
}
