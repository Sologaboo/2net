(() => {
	const API_URL = String(window.SWIFTDESK_API_URL || '').trim();
	const form = document.getElementById('resetForm');
	const message = document.getElementById('resetMessage');
	const submitButton = document.getElementById('resetButton');
	const backToLogin = document.getElementById('backToLogin');
	const passwordInput = document.getElementById('newPassword');
	const confirmInput = document.getElementById('confirmPassword');
	const token = readTokenFromFragment();

	if (token) {
		window.history.replaceState(null, '', window.location.pathname + window.location.search);
	}

	if (!token) {
		showError('El enlace no es válido. Solicita uno nuevo desde el inicio de sesión.');
		return;
	}

	validateToken();

	form.addEventListener('submit', async event => {
		event.preventDefault();
		message.className = 'reset-message';

		if (passwordInput.value.length < 12 || passwordInput.value.length > 128) {
			showError('La contraseña debe tener entre 12 y 128 caracteres.');
			passwordInput.focus();
			return;
		}
		if (passwordInput.value !== confirmInput.value) {
			showError('Las contraseñas no coinciden.');
			confirmInput.focus();
			return;
		}

		submitButton.disabled = true;
		submitButton.textContent = 'Guardando…';
		try {
			const result = await postAction({
				action: 'resetPassword',
				token,
				password: passwordInput.value
			});
			if (!result.success) throw new Error(result.message || 'No se pudo actualizar la contraseña.');
			form.hidden = true;
			message.className = 'reset-message success';
			message.textContent = result.message || 'Contraseña actualizada. Ya puedes iniciar sesión.';
			backToLogin.hidden = false;
		} catch (error) {
			console.error('No se pudo cambiar la contraseña:', error);
			showError(error.message || 'No se pudo actualizar la contraseña. Solicita un enlace nuevo.');
		} finally {
			submitButton.disabled = false;
			submitButton.textContent = 'Guardar contraseña';
			passwordInput.value = '';
			confirmInput.value = '';
		}
	});

	async function validateToken() {
		try {
			const result = await postAction({ action: 'validateResetToken', token });
			if (!result.success) throw new Error(result.message || 'El enlace venció o ya fue utilizado.');
			message.textContent = 'Enlace válido. Elige una contraseña nueva.';
			form.hidden = false;
			passwordInput.focus();
		} catch (error) {
			console.error('No se pudo validar el enlace de recuperación:', error);
			showError(error.message || 'No fue posible validar el enlace. Solicita uno nuevo.');
		}
	}

	async function postAction(payload) {
		if (!API_URL) throw new Error('El servicio de acceso aún no está configurado.');
		const response = await fetch(API_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'text/plain;charset=utf-8' },
			body: JSON.stringify(payload)
		});
		if (!response.ok) throw new Error(`El servidor respondió HTTP ${response.status}.`);
		return response.json();
	}

	function readTokenFromFragment() {
		const match = window.location.hash.match(/^#token=([^&]+)$/);
		if (!match) return '';
		try {
			return decodeURIComponent(match[1]);
		} catch (error) {
			return '';
		}
	}

	function showError(text) {
		message.className = 'reset-message error';
		message.textContent = text;
		backToLogin.hidden = false;
	}
})();
