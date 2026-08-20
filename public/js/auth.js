// Логин / регистрация

const form = document.getElementById('login-form') || document.getElementById('register-form');
const errorBox = document.getElementById('form-error');
const submitBtn = document.getElementById('submit');
const isRegister = !!document.getElementById('register-form');

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.add('show');
}

function clearError() { errorBox.classList.remove('show'); }

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();

  const body = isRegister
    ? {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        ig_username: form.ig_username.value.trim().replace(/^@/, '') || undefined,
        password: form.password.value,
      }
    : { email: form.email.value.trim(), password: form.password.value };

  if (isRegister && body.password.length < 6) {
    showError('Пароль должен быть не короче 6 символов');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = isRegister ? 'Создаём…' : 'Входим…';
  try {
    await api(`/api/auth/${isRegister ? 'register' : 'login'}`, { method: 'POST', body });
    location.href = '/dashboard.html';
  } catch (err) {
    showError(err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = isRegister ? 'Создать кабинет' : 'Войти';
  }
});

// если уже вошли — сразу в кабинет
api('/api/auth/me').then(({ user }) => {
  if (user) location.href = '/dashboard.html';
}).catch(() => {});