const form = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorBox = document.getElementById('loginError');
const loginBtn = document.getElementById('loginBtn');

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
  form.classList.remove('shake');
  void form.offsetWidth;
  form.classList.add('shake');
}

function clearError() {
  errorBox.hidden = true;
  errorBox.textContent = '';
}

// Already signed in? Skip the login page.
fetch('/api/auth/me')
  .then((res) => {
    if (res.ok) window.location.replace('/');
  })
  .catch(() => {});

document.getElementById('togglePassword').addEventListener('click', () => {
  const isHidden = passwordInput.type === 'password';
  passwordInput.type = isHidden ? 'text' : 'password';
  document.getElementById('togglePassword').textContent = isHidden ? '🙈' : '👁';
  passwordInput.focus();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showError('Please enter both email and password.');
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in...';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.message || 'Login failed. Please try again.');
    }

    window.location.replace('/');
  } catch (err) {
    showError(err.message);
    passwordInput.value = '';
    passwordInput.focus();
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign in';
  }
});

emailInput.focus();
