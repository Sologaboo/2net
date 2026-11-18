(async () => {
	const API_URL = String(window.SWIFTDESK_API_URL || '').trim();
	const SESSION_KEY = 'swift_user_session';
	const app = document.getElementById('app');
	const sidebar = document.getElementById('sidebar');
	const greeting = document.getElementById('greeting');
	const notice = document.getElementById('notice');
	const toolList = document.getElementById('toolList');
	const calculatorPanel = document.getElementById('calculatorPanel');
	const notesPanel = document.getElementById('notesPanel');
	let noticeTimer;

	function readSession() {
		try {
			const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
			const expiresAt = Number(session && session.expiresAt);
			if (!session || !session.token || !session.role ||
				!Number.isFinite(expiresAt) || Date.now() >= expiresAt) {
				localStorage.removeItem(SESSION_KEY);
				return null;
			}
			return session;
		} catch (error) {
			console.error('No se pudo validar la sesión local:', error);
			localStorage.removeItem(SESSION_KEY);
			return null;
		}
	}

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

	let session = readSession();
	if (!session) {
		window.location.replace('login.html');
		return;
	}

	try {
		const validation = await postAction({ action: 'validateSession', token: session.token });
		const expiresAt = Number(validation.expiresAt);
		if (!validation.success || !validation.user || !Number.isFinite(expiresAt) || Date.now() >= expiresAt) {
			throw new Error('La sesión venció o ya no es válida.');
		}
		session = Object.assign({}, session, validation.user, { expiresAt: expiresAt });
		localStorage.setItem(SESSION_KEY, JSON.stringify(session));
	} catch (error) {
		console.error('No se pudo validar la sesión con el backend:', error);
		localStorage.removeItem(SESSION_KEY);
		window.location.replace('login.html');
		return;
	}

	const displayName = [session.name, session.surname].filter(Boolean).join(' ').trim();
	const firstName = String(session.name || '').trim();
	if (displayName) document.getElementById('profileName').textContent = displayName;
	if (firstName) {
		document.getElementById('greetingName').textContent = firstName;
		document.getElementById('avatar').textContent = firstName.slice(0, 1).toLocaleUpperCase('es') +
			(session.surname ? String(session.surname).trim().slice(0, 1).toLocaleUpperCase('es') : '');
	}
	const roleElement = document.querySelector('.profile-role');
	if (roleElement && session.role) roleElement.textContent = session.role;
	document.body.classList.remove('auth-pending');

	function updateGreeting() {
		const hour = new Date().getHours();
		greeting.textContent = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
	}

	updateGreeting();
	document.getElementById('todayDate').textContent = new Intl.DateTimeFormat('es-MX', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	}).format(new Date());

	document.getElementById('sidebarToggle').addEventListener('click', event => {
		app.classList.toggle('sidebar-collapsed');
		const expanded = !app.classList.contains('sidebar-collapsed');
		event.currentTarget.setAttribute('aria-expanded', String(expanded));
		event.currentTarget.setAttribute('aria-label', expanded ? 'Contraer menú' : 'Expandir menú');
		event.currentTarget.textContent = expanded ? '‹' : '›';
	});

	const mobileMenu = document.getElementById('mobileMenu');
	mobileMenu.addEventListener('click', () => {
		const isOpen = sidebar.classList.toggle('mobile-open');
		mobileMenu.setAttribute('aria-expanded', String(isOpen));
		mobileMenu.setAttribute('aria-label', isOpen ? 'Cerrar menú' : 'Abrir menú');
	});

	sidebar.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', () => {
		sidebar.querySelectorAll('.nav-item').forEach(button => button.classList.remove('active'));
		item.classList.add('active');
		document.getElementById('pageTitle').textContent = item.dataset.section === 'Inicio' ? 'Panel principal' : item.dataset.section;
		sidebar.classList.remove('mobile-open');
		mobileMenu.setAttribute('aria-expanded', 'false');
		mobileMenu.setAttribute('aria-label', 'Abrir menú');
	}));

	document.getElementById('search').addEventListener('input', event => {
		const query = event.currentTarget.value.trim().toLocaleLowerCase('es');
		const cards = [...document.querySelectorAll('.card')];
		let visible = 0;
		cards.forEach(card => {
			const matches = !query || (card.textContent + ' ' + card.dataset.search).toLocaleLowerCase('es').includes(query);
			card.hidden = !matches;
			if (matches) visible++;
		});
		document.getElementById('emptyState').style.display = visible ? 'none' : 'block';
	});

	document.getElementById('toolsToggle').addEventListener('click', event => {
		const isOpen = toolList.hidden;
		toolList.hidden = !isOpen;
		event.currentTarget.setAttribute('aria-expanded', String(isOpen));
		event.currentTarget.setAttribute('aria-label', isOpen ? 'Ocultar herramientas rápidas' : 'Mostrar herramientas rápidas');
		event.currentTarget.textContent = isOpen ? '×' : '+';
	});

	document.querySelectorAll('.tool-button').forEach(button => button.addEventListener('click', () => {
		toolList.hidden = true;
		const toolsToggle = document.getElementById('toolsToggle');
		toolsToggle.setAttribute('aria-expanded', 'false');
		toolsToggle.setAttribute('aria-label', 'Mostrar herramientas rápidas');
		toolsToggle.textContent = '+';
		switch (button.dataset.tool) {
			case 'calculator':
				openPanel(calculatorPanel);
				break;
			case 'notes':
				openPanel(notesPanel);
				break;
			case 'calendar':
				showNotice('El calendario de gestión operativa aún no está conectado.');
				break;
			default:
				showNotice('Para obtener ayuda, contacta al equipo de operaciones.');
		}
	}));

	function openPanel(panel) {
		[calculatorPanel, notesPanel].forEach(otherPanel => {
			if (otherPanel !== panel) closePanel(otherPanel);
		});
		panel.hidden = false;
		panel.classList.remove('is-collapsed');
		panel.setAttribute('aria-hidden', 'false');
		const minimizeButton = panel.querySelector('[data-minimize]');
		minimizeButton.textContent = '−';
		minimizeButton.setAttribute('aria-label', panel === calculatorPanel ? 'Plegar calculadora' : 'Plegar bloc de notas');
	}

	function closePanel(panel) {
		panel.hidden = true;
		panel.classList.remove('is-collapsed');
		panel.setAttribute('aria-hidden', 'true');
	}

	document.querySelectorAll('[data-minimize]').forEach(button => button.addEventListener('click', () => {
		const panel = document.getElementById(button.dataset.minimize);
		const isCollapsed = panel.classList.toggle('is-collapsed');
		button.setAttribute('aria-label', isCollapsed
			? (panel === calculatorPanel ? 'Desplegar calculadora' : 'Desplegar bloc de notas')
			: (panel === calculatorPanel ? 'Plegar calculadora' : 'Plegar bloc de notas'));
		button.textContent = isCollapsed ? '□' : '−';
	}));

	document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => {
		closePanel(document.getElementById(button.dataset.close));
	}));

	const daysInput = document.getElementById('prorrateo-dias');
	const amountInput = document.getElementById('prorrateo-monto');
	const output = document.getElementById('prorrateo-output');
	const calculatorError = document.getElementById('calculatorError');
	const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

	function calculateProration() {
		const days = daysInput.value === '' ? NaN : Number(daysInput.value);
		const amount = amountInput.value === '' ? NaN : Number(amountInput.value);
		const validDays = Number.isInteger(days) && days >= 1 && days <= 31;
		const validAmount = Number.isFinite(amount) && amount >= 0;

		if (!validDays || !validAmount) {
			output.textContent = currency.format(0);
			calculatorError.textContent = daysInput.value || amountInput.value
				? 'Ingresa de 1 a 31 días y un monto mensual válido.'
				: '';
			return;
		}

		calculatorError.textContent = '';
		output.textContent = currency.format((amount / 30) * days);
	}

	daysInput.addEventListener('input', calculateProration);
	amountInput.addEventListener('input', calculateProration);

	const notesInput = document.getElementById('notesInput');
	const notesStatus = document.getElementById('notesStatus');
	const notesStorageKey = 'swiftdesk-dashboard-notes';
	try {
		notesInput.value = localStorage.getItem(notesStorageKey) || '';
	} catch (error) {
		console.error('No se pudieron cargar las notas guardadas:', error);
		notesStatus.textContent = 'No se pudieron cargar las notas guardadas en este dispositivo.';
	}
	notesInput.addEventListener('input', () => {
		try {
			localStorage.setItem(notesStorageKey, notesInput.value);
			notesStatus.textContent = 'Guardado automáticamente en este dispositivo.';
		} catch (error) {
			console.error('No se pudieron guardar las notas:', error);
			notesStatus.textContent = 'No se pudieron guardar las notas. Revisa el almacenamiento del navegador.';
		}
	});

	document.getElementById('dismissBanner').addEventListener('click', () => {
		document.getElementById('infoBanner').classList.add('banner-hidden');
	});
	document.getElementById('showBanner').addEventListener('click', () => {
		document.getElementById('infoBanner').classList.remove('banner-hidden');
	});
	document.getElementById('logout').addEventListener('click', () => {
		postAction({ action: 'logout', token: session.token })
			.catch(error => console.error('No se pudo cerrar la sesión en el servidor:', error));
		localStorage.removeItem(SESSION_KEY);
		window.location.replace('login.html');
	});

	document.addEventListener('keydown', event => {
		if (event.key === 'Escape') {
			[calculatorPanel, notesPanel].forEach(panel => {
				if (!panel.hidden) closePanel(panel);
			});
			sidebar.classList.remove('mobile-open');
			mobileMenu.setAttribute('aria-expanded', 'false');
			mobileMenu.setAttribute('aria-label', 'Abrir menú');
		}
	});

	function showNotice(message) {
		notice.textContent = message;
		notice.classList.add('visible');
		clearTimeout(noticeTimer);
		noticeTimer = setTimeout(() => notice.classList.remove('visible'), 2600);
	}
})();
