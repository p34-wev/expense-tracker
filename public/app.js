const API = '/api';

const state = {
  page: 1,
  limit: 5,
  search: '',
  course: '',
  status: '',
  totalPages: 1,
  deleteId: null
};

const $ = (id) => document.getElementById(id);

const els = {
  table: $('studentTable'),
  search: $('searchInput'),
  courseFilter: $('courseFilter'),
  statusFilter: $('statusFilter'),
  courseList: $('courseList'),
  prev: $('prevBtn'),
  next: $('nextBtn'),
  pageInfo: $('paginationInfo'),
  modal: $('modalBackdrop'),
  form: $('studentForm'),
  modalTitle: $('modalTitle'),
  deleteModal: $('deleteBackdrop'),
  deleteMessage: $('deleteMessage'),
  toast: $('toast'),
  dbStatus: $('dbStatus'),
  userEmail: $('userEmail'),
  userRole: $('userRole'),
  userAvatar: $('userAvatar')
};

/* ------------------------------ helpers ------------------------------ */

function toast(message, type = 'success') {
  els.toast.textContent = message;
  els.toast.className = `toast ${type}`;
  els.toast.hidden = false;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { els.toast.hidden = true; }, 2800);
}

function initials(fullName) {
  return String(fullName || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return escapeHtml(value);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function averageScore(student) {
  const marks = [student.mathematics_marks, student.science_marks, student.english_marks]
    .filter((m) => m !== null && m !== undefined && m !== '')
    .map(Number);

  if (!marks.length) return null;
  return marks.reduce((sum, m) => sum + m, 0) / marks.length;
}

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (res.status === 401) {
    window.location.replace('/login.html');
    throw new Error('Session expired. Please sign in again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

/* ------------------------------ rendering ---------------------------- */

function renderRows(students) {
  if (!students.length) {
    els.table.innerHTML = `<tr><td colspan="7" class="empty">No students found. Click “Add Student” to create one.</td></tr>`;
    return;
  }

  els.table.innerHTML = students.map((s) => {
    const avg = averageScore(s);
    const score = avg === null ? '—' : `${avg.toFixed(1)}%`;
    const width = avg === null ? 0 : Math.max(0, Math.min(100, avg));

    return `
      <tr>
        <td>
          <div class="student-cell">
            <div class="avatar">${escapeHtml(initials(s.full_name))}</div>
            <div>
              <div class="student-name">${escapeHtml(s.full_name)}</div>
              <div class="student-sub">${escapeHtml(s.phone || `ID #${s.id}`)}</div>
            </div>
          </div>
        </td>
        <td>${escapeHtml(s.email)}</td>
        <td class="nowrap">${escapeHtml(s.course)}</td>
        <td class="nowrap">${formatDate(s.enrollment_date)}</td>
        <td><span class="status-pill ${s.status === 'Active' ? 'active' : 'inactive'}">${escapeHtml(s.status)}</span></td>
        <td>
          <div class="score">
            <span class="score-value">${score}</span>
            ${avg === null ? '' : `<div class="score-bar"><i style="width:${width}%"></i></div>`}
          </div>
        </td>
        <td class="actions-col">
          <div class="actions">
            <button class="icon-btn" title="Edit" data-action="edit" data-id="${s.id}">✏️</button>
            <button class="icon-btn danger" title="Delete" data-action="delete" data-id="${s.id}">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function loadStats() {
  try {
    const stats = await api('/stats');
    $('statTotal').textContent = stats.total_students ?? 0;
    $('statActive').textContent = stats.active_students ?? 0;
    $('statCourses').textContent = stats.total_courses ?? 0;
    $('statScore').textContent = stats.avg_score === null ? '—' : `${stats.avg_score}%`;

    const current = els.courseFilter.value;
    const courses = stats.by_course.map((c) => c.course);
    els.courseFilter.innerHTML = `<option value="">All Courses</option>` +
      courses.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    els.courseFilter.value = current;
    els.courseList.innerHTML = courses.map((c) => `<option value="${escapeHtml(c)}"></option>`).join('');

    els.dbStatus.textContent = '● Connected';
    els.dbStatus.classList.remove('off');
  } catch (err) {
    els.dbStatus.textContent = '● DB offline';
    els.dbStatus.classList.add('off');
  }
}

async function loadStudents() {
  const params = new URLSearchParams({
    page: state.page,
    limit: state.limit,
    search: state.search,
    course: state.course,
    status: state.status
  });

  try {
    const { data, pagination } = await api(`/students?${params}`);
    state.totalPages = pagination.totalPages;
    renderRows(data);

    const from = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
    const to = Math.min(pagination.page * pagination.limit, pagination.total);
    els.pageInfo.textContent = `Showing ${from}–${to} of ${pagination.total} students`;
    $('pageIndicator').textContent = `${pagination.page} / ${pagination.totalPages}`;
    els.prev.disabled = pagination.page <= 1;
    els.next.disabled = pagination.page >= pagination.totalPages;
  } catch (err) {
    els.table.innerHTML = `<tr><td colspan="7" class="empty">${escapeHtml(err.message)}</td></tr>`;
    toast(err.message, 'error');
  }
}

async function refresh() {
  await Promise.all([loadStudents(), loadStats()]);
}

/* ------------------------------ modal -------------------------------- */

function openModal(student = null) {
  els.form.reset();
  $('studentId').value = student?.id || '';

  if (student) {
    els.modalTitle.textContent = 'Edit Student';
    ['full_name', 'email', 'phone', 'course', 'status'].forEach((f) => {
      els.form.elements[f].value = student[f] ?? '';
    });
    els.form.elements.enrollment_date.value = student.enrollment_date
      ? String(student.enrollment_date).slice(0, 10)
      : '';
    ['mathematics_marks', 'science_marks', 'english_marks'].forEach((f) => {
      els.form.elements[f].value = student[f] ?? '';
    });
  } else {
    els.modalTitle.textContent = 'Add Student';
    els.form.elements.status.value = 'Active';
    els.form.elements.enrollment_date.value = new Date().toISOString().slice(0, 10);
  }

  els.modal.hidden = false;
  setTimeout(() => els.form.elements.full_name.focus(), 50);
}

function closeModal() {
  els.modal.hidden = true;
}

function closeDelete() {
  els.deleteModal.hidden = true;
  state.deleteId = null;
}

/* ------------------------------ events ------------------------------- */

$('addStudentBtn').onclick = () => openModal();
$('closeModalBtn').onclick = closeModal;
$('cancelBtn').onclick = closeModal;
els.modal.addEventListener('click', (e) => { if (e.target === els.modal) closeModal(); });

$('closeDeleteBtn').onclick = closeDelete;
$('cancelDeleteBtn').onclick = closeDelete;
els.deleteModal.addEventListener('click', (e) => { if (e.target === els.deleteModal) closeDelete(); });

els.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(els.form).entries());
  const id = payload.id;
  delete payload.id;

  const btn = $('saveBtn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    if (id) {
      await api(`/students/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      toast('Student updated successfully');
    } else {
      await api('/students', { method: 'POST', body: JSON.stringify(payload) });
      toast('Student added successfully');
    }
    closeModal();
    await refresh();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Student';
  }
});

els.table.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;

  if (btn.dataset.action === 'edit') {
    try {
      const student = await api(`/students/${id}`);
      openModal(student);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  if (btn.dataset.action === 'delete') {
    state.deleteId = id;
    const row = btn.closest('tr');
    const name = row.querySelector('.student-name')?.textContent || 'this student';
    els.deleteMessage.textContent = `Are you sure you want to delete ${name}? This action cannot be undone.`;
    els.deleteModal.hidden = false;
  }
});

$('confirmDeleteBtn').onclick = async () => {
  if (!state.deleteId) return;
  const btn = $('confirmDeleteBtn');
  btn.disabled = true;
  btn.textContent = 'Deleting...';
  try {
    await api(`/students/${state.deleteId}`, { method: 'DELETE' });
    toast('Student deleted successfully');
    closeDelete();
    if (state.page > 1) state.page = 1;
    await refresh();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Delete';
  }
};

let searchTimer;
els.search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = els.search.value;
    state.page = 1;
    loadStudents();
  }, 300);
});

els.courseFilter.addEventListener('change', () => {
  state.course = els.courseFilter.value;
  state.page = 1;
  loadStudents();
});

els.statusFilter.addEventListener('change', () => {
  state.status = els.statusFilter.value;
  state.page = 1;
  loadStudents();
});

els.prev.onclick = () => {
  if (state.page > 1) { state.page--; loadStudents(); }
};
els.next.onclick = () => {
  if (state.page < state.totalPages) { state.page++; loadStudents(); }
};

document.querySelectorAll('.nav-link').forEach((link) => {
  link.addEventListener('click', () => {
    document.querySelectorAll('.nav-link').forEach((l) => l.classList.remove('active'));
    link.classList.add('active');
    const studentsView = link.getAttribute('href') === '#students';
    $('pageTitle').textContent = studentsView ? 'Students' : 'Dashboard';
    $('pageSubtitle').textContent = studentsView
      ? 'Manage your student records'
      : 'Overview of your student records';
    $('statsSection').style.display = studentsView ? 'none' : 'grid';
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeModal(); closeDelete(); }
});

$('logoutBtn').onclick = async () => {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } finally {
    window.location.replace('/login.html');
  }
};

/* ------------------------------- init -------------------------------- */

async function loadSession() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      window.location.replace('/login.html');
      return false;
    }
    const { user } = await res.json();
    els.userEmail.textContent = user.email;
    els.userEmail.title = user.email;
    els.userRole.textContent = user.role === 'admin' ? 'Administrator' : 'User';
    els.userAvatar.textContent = user.email[0].toUpperCase();
    return true;
  } catch {
    window.location.replace('/login.html');
    return false;
  }
}

(async () => {
  if (await loadSession()) refresh();
})();
