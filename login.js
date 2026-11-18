(() => {
	const API_URL = String(window.SWIFTDESK_API_URL || '').trim();
	const SESSION_KEY = 'swift_user_session';
	const form = document.getElementById('loginForm');
	const emailInput = document.getElementById('email');
	const passwordInput = document.getElementById('password');
	const submitButton = document.getElementById('loginButton');
	const message = document.getElementById('loginMessage');

	function readSession() {
		try {
			const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
			const expiresAt = Number(session && session.expiresAt);
			if (!session || !session.token || !Number.isFinite(expiresAt) ||
				Date.now() >= expiresAt) {
				localStorage.removeItem(SESSION_KEY);
				return null;
			}
			return session;
		} catch (error) {
			console.error('No se pudo leer la sesión:', error);
			localStorage.removeItem(SESSION_KEY);
			return null;
		}
	}

	if (readSession()) {
		window.location.replace('index.html');
		return;
	}

	form.addEventListener('submit', async event => {
		event.preventDefault();
		message.className = 'login-message';

		if (!emailInput.value.trim() || !emailInput.validity.valid || !passwordInput.value) {
			message.textContent = 'Ingresa un correo válido y tu contraseña.';
			message.classList.add('error');
			(!emailInput.value.trim() || !emailInput.validity.valid ? emailInput : passwordInput).focus();
			return;
		}

		submitButton.disabled = true;
		submitButton.textContent = 'Verificando...';
		message.textContent = 'Estamos verificando tus credenciales.';

		try {
			const result = await postAction({
				action: 'login',
				email: emailInput.value.trim(),
				password: passwordInput.value
			});

			if (!result || !(result.success || result.status === 'success' || result.valido)) {
				message.textContent = result && result.message
					? result.message
					: 'No se pudo iniciar sesión. Revisa tus credenciales.';
				message.classList.add('error');
				return;
			}

			const role = normalizeRole(result.rol || result.role);
			const area = normalizeArea(result.area);
			const name = String(result.nombre || result.name || '').trim();
			const surname = String(result.apellido || result.surname || '').trim();
			const token = String(result.token || '');
			const expiresAt = Number(result.expiresAt);
			if (!role || !area || !name || !surname || !token ||
				!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
				throw new Error('El servidor no devolvió los datos requeridos para crear una sesión.');
			}

			const session = {
				email: String(result.email || emailInput.value.trim()).toLowerCase(),
				name,
				surname,
				role,
				area,
				token,
				expiresAt
			};
			localStorage.setItem(SESSION_KEY, JSON.stringify(session));
			message.textContent = `Bienvenido, ${name}.`;
			message.classList.add('success');
			window.location.replace('index.html');
		} catch (error) {
			console.error('Error de autenticación:', error);
			message.textContent = 'No fue posible conectar con el servicio de acceso. Inténtalo nuevamente.';
			message.classList.add('error');
		} finally {
			submitButton.disabled = false;
			submitButton.textContent = 'Iniciar sesión';
		}
	});

	const recoveryButton = document.getElementById('recoveryButton');
	recoveryButton.addEventListener('click', async () => {
		message.className = 'login-message';
		if (!emailInput.value.trim() || !emailInput.validity.valid) {
			message.textContent = 'Ingresa un correo válido para solicitar la recuperación.';
			message.classList.add('error');
			emailInput.focus();
			return;
		}

		recoveryButton.disabled = true;
		recoveryButton.textContent = 'Enviando solicitud...';
		try {
			const result = await postAction({
				action: 'requestPasswordReset',
				email: emailInput.value.trim()
			});
			if (!result.success) throw new Error(result.message || 'No se pudo enviar la solicitud.');
			message.textContent = result.message;
		} catch (error) {
			console.error('No se pudo solicitar la recuperación:', error);
			message.textContent = 'No fue posible enviar la solicitud. Inténtalo nuevamente más tarde.';
			message.classList.add('error');
		} finally {
			recoveryButton.disabled = false;
			recoveryButton.textContent = '¿Olvidaste tu contraseña?';
		}
	});

	async function postAction(payload) {
		if (!API_URL) throw new Error('Configura la URL de Apps Script en config.js.');
		const response = await fetch(API_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'text/plain;charset=utf-8' },
			body: JSON.stringify(payload)
		});
		if (!response.ok) throw new Error(`El servidor respondió HTTP ${response.status}.`);
		return response.json();
	}

	function normalizeRole(value) {
		const role = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
		if (role === 'administrador' || role === 'admin') return 'Administrador';
		if (role === 'asesor') return 'Asesor';
		return null;
	}

	function normalizeArea(value) {
		const area = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
		if (area === 'soporte') return 'Soporte';
		if (area === 'atencion al cliente') return 'Atención al cliente';
		if (area === 'administracion') return 'Administración';
		return null;
	}
})();
