// ============================================================
// ====================== UI УТИЛИТЫ ==========================
// ============================================================
const UI = {
    toast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
    },
    openModal(title, html) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = html;
        document.getElementById('modal-overlay').classList.add('active');
    },
    closeModal() { document.getElementById('modal-overlay').classList.remove('active'); },
    confirm(msg) { return window.confirm(msg); },
    escape(str) {
        if (str == null) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    },
    formatDate(dateStr) {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleString('ru-RU', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    },
    formatDateShort(dateStr) {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('ru-RU');
    },
    formatSize(bytes) {
        if (!bytes) return '';
        if (bytes < 1024) return bytes + ' Б';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' КБ';
        return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
    },
    roleName(role) {
        return { student: 'Студент', teacher: 'Преподаватель', staff: 'Сотрудник', admin: 'Админ' }[role] || role;
    },
    statusName(s) {
        return { available: 'Свободен', issued: 'Выдан', lost: 'Утерян' }[s] || s;
    },
    actionName(a) {
        return { issue: 'Выдача', return: 'Возврат', lost: 'Утеря' }[a] || a;
    },
};

// Модалка: закрытие
document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') UI.closeModal();
});
document.getElementById('modal-close').addEventListener('click', () => UI.closeModal());
document.addEventListener('keydown', e => { if (e.key === 'Escape') UI.closeModal(); });

// ============================================================
// ==================== СОСТОЯНИЕ AUTH ========================
// ============================================================
let currentUser = null;

function isAdmin() { return currentUser && currentUser.role === 'admin'; }

function applyRBAC() {
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = isAdmin() ? '' : 'none';
    });
}

function initials(name) {
    return (name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function showApp() {
    document.getElementById('login-screen').style.display = 'none';
    const app = document.getElementById('app');
    app.classList.remove('app-hidden');
    app.style.display = '';
    renderHeaderUser();
    applyRBAC();
}

function showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app').classList.add('app-hidden');
    currentUser = null;
}

async function doLogout() {
    await api.logout();
    window.location.hash = '';
    showLogin();
    UI.toast('Вы вышли из системы', 'info');
}

async function renderHeaderUser() {
    const chip = document.getElementById('current-user-badge');
    if (!chip) return;
    chip.className = 'user-chip';
    chip.onclick = () => { window.location.hash = '#/profile'; };
    try {
        const me = await api.getMe();
        // ИСПРАВЛЕНО: всегда используем api.avatarUrl
        const src = api.avatarUrl(me.id); 
        chip.innerHTML = `
            <img class="user-chip-avatar" src="${src}" alt="">
            <span class="user-chip-name">${UI.escape(me.full_name)}</span>
        `;
        const img = chip.querySelector('img');
        img.addEventListener('error', () => {
            const span = document.createElement('span');
            span.className = 'user-chip-initials';
            span.textContent = initials(me.full_name);
            img.replaceWith(span);
        });
    } catch {
        chip.innerHTML = `<span class="user-chip-name">${UI.roleName(currentUser.role)}</span>`;
    }
}

// ============================================================
// ===================== ИНИЦИАЛИЗАЦИЯ ========================
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    initSidebar();
    initEquipmentPage();
    initKeysPage();
    initArticlesPage();
    initUsersPage();

    window.addEventListener('hashchange', handleRoute);

    const refreshed = await api.refresh();
    if (refreshed) {
        currentUser = api.parseToken();
        if (currentUser) {
            showApp();
            handleRoute();
            return;
        }
    }
    showLogin();
});

// ============================================================
// ========================= САЙДБАР ==========================
// ============================================================
function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const toggle  = document.getElementById('sidebar-toggle');
    const close   = document.getElementById('sidebar-close');

    const openSidebar  = () => { sidebar.classList.add('open'); overlay.classList.add('active'); toggle.classList.add('active'); };
    const closeSidebar = () => { sidebar.classList.remove('open'); overlay.classList.remove('active'); toggle.classList.remove('active'); };
    const toggleSidebar = () => sidebar.classList.contains('open') ? closeSidebar() : openSidebar();

    toggle.addEventListener('click', toggleSidebar);
    close.addEventListener('click', closeSidebar);
    overlay.addEventListener('click', closeSidebar);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSidebar(); });

    document.querySelectorAll('.sidebar-item[data-page]').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            const page = item.dataset.page;
            if (page === 'profile') {
                window.location.hash = '#/profile';
            } else {
                window.location.hash = '';
                document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
                const target = document.getElementById(`page-${page}`);
                if (target) target.classList.add('active');
                if (page === 'equipment') loadEquipment();
                if (page === 'keys') loadKeys();
                if (page === 'articles') loadArticles();
                if (page === 'users') loadUsers();
            }
            if (window.innerWidth < 1024) closeSidebar();
        });
    });

    document.getElementById('btn-logout').addEventListener('click', doLogout);
}

function setActiveSidebarItem(page) {
    document.querySelectorAll('.sidebar-item[data-page]').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });
}

// ============================================================
// ======================== РОУТИНГ ===========================
// ============================================================
function handleRoute() {
    const eqMatch = window.location.hash.match(/^#\/equipment\/view\/(\d+)$/);
    if (eqMatch) {
        if (!currentUser) { showLogin(); return; }
        renderEquipmentPage(parseInt(eqMatch[1]));
        setActiveSidebarItem('equipment');
        return;
    }
    const artMatch = window.location.hash.match(/^#\/article\/view\/(\d+)$/);
    if (artMatch) {
        if (!currentUser) { showLogin(); return; }
        renderArticlePage(parseInt(artMatch[1]));
        setActiveSidebarItem('articles');
        return;
    }
    const userMatch = window.location.hash.match(/^#\/user\/(\d+)$/);
    if (userMatch) {
        if (!currentUser) { showLogin(); return; }
        renderUserProfilePage(userMatch[1]);
        setActiveSidebarItem('users');
        return;
    }
    const userArtMatch = window.location.hash.match(/^#\/my-articles\/(\d+)$/);
    if (userArtMatch) {
        if (!currentUser) { showLogin(); return; }
        renderUserArticlesPage(userArtMatch[1]);
        setActiveSidebarItem('users');
        return;
    }
    if (window.location.hash === '#/profile') {
        if (!currentUser) { showLogin(); return; }
        renderProfilePage();
        setActiveSidebarItem('profile');
        return;
    }
    if (window.location.hash === '#/my-articles') {
        if (!currentUser) { showLogin(); return; }
        renderMyArticlesPage();
        setActiveSidebarItem('profile');
        return;
    }
    if (window.location.hash === '#/users' || window.location.hash === '') {
        if (!currentUser) { showLogin(); return; }
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-users').classList.add('active');
        setActiveSidebarItem('users');
        loadUsers();
        return;
    }
    showMainApp();
}

function showMainApp() {
    const view = document.getElementById('full-page-view');
    if (view) view.style.display = 'none';
    document.getElementById('app').style.display = '';
    const active = document.querySelector('.page.active');
    if (active && active.id === 'page-equipment') loadEquipment();
}

window.addEventListener('auth:logout', () => {
    showLogin();
    UI.toast('Сессия истекла, войдите заново', 'error');
});

// ============================================================
// ========================= ВХОД =============================
// ============================================================
document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');
    errEl.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Вход...';

    try {
        currentUser = await api.signIn(fd.get('email').trim(), fd.get('password'));
        if (!currentUser) throw new Error('Не удалось распознать пользователя');
        showApp();
        handleRoute();
        UI.toast('Добро пожаловать!', 'success');
    } catch (err) {
        errEl.textContent = err.message;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Войти';
    }
});

// ============================================================
// ==================== ОБОРУДОВАНИЕ ==========================
// ============================================================
const eqState = { limit: 10, offset: 0, search: '', inventory: '', status: '', isExpiredMode: false };

function initEquipmentPage() {
    document.getElementById('btn-add-eq').addEventListener('click', () => showEquipmentForm());
    let t1;
    document.getElementById('eq-search').addEventListener('input', e => {
        clearTimeout(t1);
        t1 = setTimeout(() => { eqState.search = e.target.value; eqState.offset = 0; loadEquipment(); }, 300);
    });
    let t2;
    document.getElementById('eq-inventory').addEventListener('input', e => {
        clearTimeout(t2);
        t2 = setTimeout(() => { eqState.inventory = e.target.value; eqState.offset = 0; loadEquipment(); }, 300);
    });
    document.getElementById('eq-status-filter').addEventListener('change', e => {
        eqState.status = e.target.value; eqState.offset = 0; loadEquipment();
    });
    document.getElementById('btn-expired-verification').addEventListener('click', () => {
        eqState.isExpiredMode = !eqState.isExpiredMode;
        const btn = document.getElementById('btn-expired-verification');
        btn.className = eqState.isExpiredMode ? 'btn btn-danger btn-sm' : 'btn btn-warning btn-sm';
        btn.textContent = eqState.isExpiredMode ? '❌ Показать все' : '⚠️ Просрочена поверка';
        eqState.offset = 0;
        loadEquipment();
    });
}

async function loadEquipment() {
    const tbody = document.getElementById('equipment-table-body');
    tbody.innerHTML = '<tr><td colspan="8" class="loading">Загрузка...</td></tr>';
    try {
        const data = eqState.isExpiredMode
            ? await api.getExpiredVerification(eqState.limit, eqState.offset)
            : await api.getEquipment({ limit: eqState.limit, offset: eqState.offset, search: eqState.search, inventory: eqState.inventory, status: eqState.status });

        const items = data.equipment || [];
        const meta = data.paginated_metadata || { total: 0, page: 1, total_pages: 1 };

        if (!items.length) {
            tbody.innerHTML = `<tr><td colspan="8" class="empty-state">${eqState.isExpiredMode ? 'Нет просроченных' : 'Не найдено'}</td></tr>`;
            document.getElementById('eq-pagination').innerHTML = '';
            return;
        }

        const rows = await Promise.all(items.map(async eq => {
            let resp = '—';
            if (eq.responsible_id) {
                try { const u = await api.getUser(eq.responsible_id); if (u) resp = u.full_name; } catch {}
            }
            return renderEqRow(eq, resp);
        }));

        tbody.innerHTML = rows.join('');
        attachEqActions();
        renderEqPagination(meta.total_pages, meta.page);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state">${UI.escape(err.message)}</td></tr>`;
    }
}

function renderEqRow(eq, resp) {
    let verif = '<span class="text-muted">—</span>';
    if (eq.next_verification_date) {
        const expired = new Date(eq.next_verification_date) < new Date();
        verif = `<span style="color:${expired ? '#dc2626' : '#16a34a'};font-weight:${expired ? 'bold' : 'normal'}">${UI.formatDateShort(eq.next_verification_date)}${expired ? ' ⚠️' : ''}</span>`;
    }
    let badge;
    if (eq.status) {
        badge = '<span class="badge badge-available">Доступно</span>';
    } else {
        badge = `<span class="badge badge-lost">Недоступно</span><div class="unavailable-reason">${UI.escape(eq.unavailable_reason || 'Причина не указана')}</div>`;
    }
    const adminBtns = isAdmin() ? `
        <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${eq.id}">✏️</button>
        <button class="btn btn-danger btn-sm" data-action="delete" data-id="${eq.id}">🗑️</button>` : '';

    return `<tr class="${eq.status ? '' : 'row-unavailable'}">
        <td>${eq.id}</td><td><strong>${UI.escape(eq.name)}</strong></td>
        <td>${UI.escape(eq.inventory_number || '—')}</td><td>${UI.escape(eq.location || '—')}</td>
        <td>${UI.escape(resp)}</td><td>${verif}</td><td>${badge}</td>
        <td class="actions-cell"><button class="btn btn-secondary btn-sm" data-action="view" data-id="${eq.id}">👁️</button>${adminBtns}</td>
    </tr>`;
}

function attachEqActions() {
    document.querySelectorAll('#equipment-table-body [data-action]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = parseInt(btn.dataset.id);
            if (btn.dataset.action === 'view') window.location.hash = `/equipment/view/${id}`;
            if (btn.dataset.action === 'edit') await showEquipmentForm(id);
            if (btn.dataset.action === 'delete') await deleteEquipment(id);
        });
    });
}

window.uploadPhotoForEquipment = async function(equipmentId, input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { UI.toast('Файл слишком большой (макс. 10 МБ)', 'error'); input.value = ''; return; }
    try {
        await api.uploadPhoto(equipmentId, file);
        UI.toast('Фото загружено', 'success');
        renderEquipmentPage(equipmentId);
    } catch (err) { UI.toast(err.message, 'error'); }
    finally { input.value = ''; }
};

async function showEquipmentForm(id = null) {
    let eq = { name: '', description: '', location: '', documentation: '', inventory_number: '', responsible_id: '', status: true, unavailable_reason: '', last_verification_date: '', next_verification_date: '' };
    if (id) {
        try {
            eq = await api.getEquipmentById(id);
            if (eq.last_verification_date) eq.last_verification_date = eq.last_verification_date.substring(0, 10);
            if (eq.next_verification_date) eq.next_verification_date = eq.next_verification_date.substring(0, 10);
        } catch (err) { UI.toast(err.message, 'error'); return; }
    }
    let users = []; try { users = await api.getUsers(); } catch {}
    const opts = users.map(u => `<option value="${u.id}" ${eq.responsible_id === u.id ? 'selected' : ''}>${UI.escape(u.full_name)}</option>`).join('');
    const reasons = ['На ремонте', 'Неисправно', 'Списано', 'Используется', 'Другое'];
    const reasonOpts = reasons.map(r => `<option value="${r}" ${eq.unavailable_reason === r ? 'selected' : ''}>${r}</option>`).join('');
    const isCustom = eq.unavailable_reason && !reasons.includes(eq.unavailable_reason);

    UI.openModal(id ? 'Редактировать оборудование' : 'Новое оборудование', `
        <form id="eq-form">
            <div class="form-group"><label>Название <span class="required">*</span></label><input type="text" class="input" name="name" value="${UI.escape(eq.name)}" required minlength="1"></div>
            <div class="form-group"><label>Описание</label><textarea class="input" name="description" rows="2" placeholder="Как работать, особенности...">${UI.escape(eq.description || '')}</textarea></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div class="form-group"><label>Инв. номер</label><input type="text" class="input" name="inventory_number" value="${UI.escape(eq.inventory_number || '')}"></div>
                <div class="form-group"><label>Локация <span class="required">*</span></label><input type="text" class="input" name="location" value="${UI.escape(eq.location || '')}" required placeholder="Каб. 305, стеллаж 2..."></div>
            </div>
            <div class="form-group"><label>Документация (URL)</label><input type="text" class="input" name="documentation" value="${UI.escape(eq.documentation || '')}" placeholder="https://..."></div>
            <div class="form-group"><label>Ответственный <span class="required">*</span></label><select class="input" name="responsible_id" required><option value="" disabled ${!eq.responsible_id ? 'selected' : ''}>Выберите ответственного...</option>${opts}</select></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div class="form-group"><label>Последняя поверка</label><input type="date" class="input" name="last_verification_date" value="${eq.last_verification_date || ''}"></div>
                <div class="form-group"><label>Следующая поверка</label><input type="date" class="input" name="next_verification_date" value="${eq.next_verification_date || ''}"></div>
            </div>
            <div class="form-group"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" name="status" id="eq-status-cb" ${eq.status ? 'checked' : ''}> Доступно</label></div>
            <div class="form-group" id="reason-block" style="display:${eq.status ? 'none' : 'block'};">
                <label>Причина недоступности</label>
                <select class="input" name="unavailable_reason" id="reason-select"><option value="">— Выберите —</option>${reasonOpts}<option value="__custom" ${isCustom ? 'selected' : ''}>Другое...</option></select>
                <input type="text" class="input" name="custom_reason" id="custom-reason" style="display:${isCustom ? 'block' : 'none'};margin-top:8px;" placeholder="Укажите причину" value="${isCustom ? UI.escape(eq.unavailable_reason) : ''}">
            </div>
            <div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Отмена</button><button type="submit" class="btn btn-primary">${id ? 'Сохранить' : 'Создать'}</button></div>
        </form>`);

    document.getElementById('eq-status-cb').addEventListener('change', e => { document.getElementById('reason-block').style.display = e.target.checked ? 'none' : 'block'; });
    document.getElementById('reason-select').addEventListener('change', e => { document.getElementById('custom-reason').style.display = e.target.value === '__custom' ? 'block' : 'none'; });

    document.getElementById('eq-form').addEventListener('submit', async e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const statusVal = fd.get('status') === 'on';
        let reason = null;
        if (!statusVal) {
            const sel = fd.get('unavailable_reason');
            reason = sel === '__custom' ? (fd.get('custom_reason').trim() || 'Не указана') : (sel || null);
        }
        const payload = {
            name: fd.get('name').trim(), description: fd.get('description').trim() || null, location: fd.get('location').trim() || null,
            documentation: fd.get('documentation').trim() || null, inventory_number: fd.get('inventory_number').trim() || null,
            responsible_id: fd.get('responsible_id') || null, status: statusVal, unavailable_reason: reason,
            last_verification_date: fd.get('last_verification_date') || null, next_verification_date: fd.get('next_verification_date') || null
        };
        try {
            if (id) { await api.updateEquipment(id, payload); UI.toast('Обновлено', 'success'); }
            else { await api.createEquipment(payload); UI.toast('Создано', 'success'); }
            UI.closeModal();
            if (window.location.hash.match(/#\/equipment\/view\/\d+/)) renderEquipmentPage(id);
            else loadEquipment();
        } catch (err) { UI.toast(err.message, 'error'); }
    });
}

async function deleteEquipment(id) {
    if (!UI.confirm('Удалить оборудование?')) return;
    try { await api.deleteEquipment(id); UI.toast('Удалено', 'success'); loadEquipment(); }
    catch (err) { UI.toast(err.message, 'error'); }
}

function renderEqPagination(totalPages, page) {
    const c = document.getElementById('eq-pagination');
    if (totalPages <= 1) { c.innerHTML = ''; return; }
    c.innerHTML = `<div style="display:flex;gap:8px;justify-content:center;margin-top:16px;align-items:center;">
        <button class="btn btn-sm btn-secondary" ${page === 1 ? 'disabled' : ''} onclick="changeEqPage(${page - 1})">←</button>
        <span style="font-size:14px;">${page} / ${totalPages}</span>
        <button class="btn btn-sm btn-secondary" ${page === totalPages ? 'disabled' : ''} onclick="changeEqPage(${page + 1})">→</button></div>`;
}
window.changeEqPage = p => { if (p < 1) return; eqState.offset = (p - 1) * eqState.limit; loadEquipment(); };

async function renderEquipmentPage(id) {
    document.getElementById('app').style.display = 'none';
    let view = document.getElementById('full-page-view');
    if (!view) { view = document.createElement('div'); view.id = 'full-page-view'; document.body.appendChild(view); }
    view.style.display = 'block';
    view.innerHTML = '<div class="ep-loading">Загрузка карточки...</div>';
    window.scrollTo(0, 0);

    try {
        const eq = await api.getEquipmentById(id);
        let resp = 'Не назначен';
        if (eq.responsible_id) { try { const u = await api.getUser(eq.responsible_id); if (u) resp = u.full_name; } catch {} }
        let photos = []; try { photos = await api.getPhotos(eq.id) || []; } catch {}

        const lastVerif = eq.last_verification_date ? UI.formatDateShort(eq.last_verification_date) : '—';
        let nextVerifHeader = '—', nextVerifFact = '—';
        if (eq.next_verification_date) {
            const expired = new Date(eq.next_verification_date) < new Date();
            nextVerifHeader = `<span style="color:${expired ? '#fff' : '#c7f5d4'};font-weight:700">${UI.formatDateShort(eq.next_verification_date)}${expired ? ' · просрочена!' : ''}</span>`;
            nextVerifFact = `<span style="color:${expired ? 'var(--danger)' : 'var(--success)'};font-weight:700">${UI.formatDateShort(eq.next_verification_date)}${expired ? ' ⚠️' : ''}</span>`;
        }
        const statusBadge = eq.status ? '<span class="ep-status ep-status-ok">✓ Доступно</span>' : '<span class="ep-status ep-status-bad">✕ Недоступно</span>';
        const reasonLine = (!eq.status && eq.unavailable_reason) ? `<div class="ep-reason">Причина: ${UI.escape(eq.unavailable_reason)}</div>` : '';
        let docHtml = '<span class="ep-muted">—</span>';
        if (eq.documentation) docHtml = eq.documentation.startsWith('http') ? `<a href="${UI.escape(eq.documentation)}" target="_blank" class="ep-doc-link">🔗 Открыть документацию</a>` : UI.escape(eq.documentation);

        const featured = photos.length ? photos[0] : null;
        const mainImg = featured ? `<img id="ep-main-img" src="${api.photoUrl(featured.id)}" alt="${UI.escape(featured.filename)}" title="Открыть в новой вкладке">` : `<div id="ep-main-img" class="ep-no-photo">📷<span>Нет фотографий</span></div>`;
        const thumbs = photos.map((p, i) => `<div class="ep-thumb ${i === 0 ? 'active' : ''}" data-url="${api.photoUrl(p.id)}" data-id="${p.id}" title="${UI.escape(p.filename)} · ${UI.formatSize(p.size_bytes)}"><img src="${api.photoUrl(p.id)}" alt="${UI.escape(p.filename)}">${isAdmin() ? `<button class="ep-thumb-del" data-del="${p.id}" title="Удалить">×</button>` : ''}</div>`).join('');
        const addPhotoTile = isAdmin() ? `<label class="ep-thumb ep-add" title="Добавить фото"><span>＋</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" style="display:none" onchange="uploadPhotoForEquipment(${eq.id}, this)"></label>` : '';

        view.innerHTML = `<div class="ep-container">
            <div class="ep-topbar"><button class="ep-back" onclick="window.location.hash=''">← К списку оборудования</button>
                <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                    <span class="user-badge">${UI.roleName(currentUser.role)}</span>
                    ${isAdmin() ? `<button class="btn btn-primary" onclick="showEquipmentForm(${eq.id})">✏️ Редактировать</button>` : ''}
                    <button class="ep-back" onclick="doLogout()">Выйти</button>
                </div></div>
            <div class="ep-header"><div class="ep-id">ID ${eq.id}</div><h1 class="ep-title">${UI.escape(eq.name)}</h1>
                <div class="ep-statusline">${statusBadge}${reasonLine}</div>
                <div class="ep-quick"><span>📍 ${UI.escape(eq.location || '—')}</span><span>👤 ${UI.escape(resp)}</span><span>🗓 След. поверка: ${nextVerifHeader}</span></div></div>
            <div class="ep-grid">
                <div class="ep-card ep-gallery-card"><div class="ep-main">${mainImg}</div>${(photos.length || isAdmin()) ? `<div class="ep-thumbs">${thumbs}${addPhotoTile}</div>` : ''}</div>
                <div class="ep-card ep-facts-card"><h2 class="ep-card-title">Сведения</h2>
                    <div class="ep-fact"><span class="ep-label">Инвентарный номер</span><span class="ep-value">${UI.escape(eq.inventory_number || '—')}</span></div>
                    <div class="ep-fact"><span class="ep-label">Локация</span><span class="ep-value">${UI.escape(eq.location || '—')}</span></div>
                    <div class="ep-fact"><span class="ep-label">Ответственный</span><span class="ep-value">${UI.escape(resp)}</span></div>
                    <div class="ep-fact"><span class="ep-label">Последняя поверка</span><span class="ep-value">${lastVerif}</span></div>
                    <div class="ep-fact"><span class="ep-label">Следующая поверка</span><span class="ep-value">${nextVerifFact}</span></div>
                    <div class="ep-fact"><span class="ep-label">Документация</span><span class="ep-value">${docHtml}</span></div>
                    <div class="ep-fact"><span class="ep-label">Статус</span><span class="ep-value">${eq.status ? 'Доступно' : 'Недоступно'}</span></div></div>
            </div>
            <div class="ep-card ep-desc-card"><h2 class="ep-card-title">Описание</h2><p class="ep-desc">${UI.escape(eq.description || 'Описание отсутствует.')}</p></div>
            <div class="ep-meta">Создано: ${UI.formatDate(eq.created_at)} · Обновлено: ${UI.formatDate(eq.updated_at)}</div></div>`;

        wireEquipmentPage(eq, photos);
    } catch (err) {
        view.innerHTML = `<div class="ep-error"><div class="ep-error-icon">⚠️</div><h2>Не удалось загрузить оборудование</h2><p>${UI.escape(err.message)}</p><button class="btn btn-secondary" onclick="window.location.hash=''">← Вернуться к списку</button></div>`;
    }
}

function wireEquipmentPage(eq, photos) {
    document.querySelectorAll('.ep-thumb[data-url]').forEach(th => {
        th.addEventListener('click', (e) => {
            if (e.target.closest('.ep-thumb-del')) return;
            const main = document.getElementById('ep-main-img');
            const url = th.dataset.url;
            if (main && main.tagName === 'IMG') { main.src = url; }
            else if (main) { const img = document.createElement('img'); img.id = 'ep-main-img'; img.src = url; main.replaceWith(img); }
            document.querySelectorAll('.ep-thumb').forEach(t => t.classList.remove('active'));
            th.classList.add('active');
        });
    });
    const main = document.getElementById('ep-main-img');
    if (main && main.tagName === 'IMG') main.addEventListener('click', () => window.open(main.src, '_blank'));
    document.querySelectorAll('.ep-thumb-del').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!UI.confirm('Удалить фото?')) return;
            try { await api.deletePhoto(parseInt(btn.dataset.del)); UI.toast('Фото удалено', 'success'); renderEquipmentPage(eq.id); }
            catch (err) { UI.toast(err.message, 'error'); }
        });
    });
}

// ============================================================
// ========================= СТАТЬИ ===========================
// ============================================================
const artState = { limit: 10, offset: 0, search: '', status: '' };
function articleStatusName(s) { return { planned: 'План', submitted: 'Подана', published: 'Вышла' }[s] || s; }

function initArticlesPage() {
    document.getElementById('btn-add-article').addEventListener('click', () => showArticleForm());
    let t;
    document.getElementById('art-search').addEventListener('input', e => {
        clearTimeout(t); t = setTimeout(() => { artState.search = e.target.value; artState.offset = 0; loadArticles(); }, 300);
    });
    document.getElementById('art-status-filter').addEventListener('change', e => { artState.status = e.target.value; artState.offset = 0; loadArticles(); });
}

async function loadArticles() {
    const tbody = document.getElementById('articles-table-body');
    tbody.innerHTML = '<tr><td colspan="6" class="loading">Загрузка...</td></tr>';
    try {
        const data = await api.getArticles({ limit: artState.limit, offset: artState.offset, search: artState.search, status: artState.status });
        const items = data.articles || [];
        const meta = data.paginated_metadata || { total: 0, page: 1, total_pages: 1 };
        if (!items.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Статьи не найдены</td></tr>'; document.getElementById('art-pagination').innerHTML = ''; return; }
        tbody.innerHTML = items.map((a, i) => renderArticleRow(a, artState.offset + i + 1)).join('');
        attachArticleActions();
        renderArtPagination(meta.total_pages, meta.page);
    } catch (err) { tbody.innerHTML = `<tr><td colspan="6" class="empty-state">${UI.escape(err.message)}</td></tr>`; }
}

function renderArticleRow(a, num) {
    const authors = (a.authors || []).map(x => x.name).join(', ');
    return `<tr><td>${num}</td><td><strong>${UI.escape(a.title)}</strong><div class="text-muted" style="font-size:12px;margin-top:2px;">${UI.escape(authors)}</div></td>
        <td>${UI.escape(a.indexing || '—')}</td><td>${UI.escape(a.white_list_level || '—')}</td>
        <td><span class="badge badge-${a.status}">${articleStatusName(a.status)}</span></td>
        <td class="actions-cell"><button class="btn btn-secondary btn-sm" data-action="view" data-id="${a.id}">👁️</button><button class="btn btn-secondary btn-sm" data-action="edit" data-id="${a.id}">✏️</button><button class="btn btn-danger btn-sm" data-action="delete" data-id="${a.id}">🗑️</button></td></tr>`;
}

function attachArticleActions() {
    document.querySelectorAll('#articles-table-body [data-action]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = parseInt(btn.dataset.id);
            if (btn.dataset.action === 'view') window.location.hash = `/article/view/${id}`;
            if (btn.dataset.action === 'edit') await showArticleForm(id);
            if (btn.dataset.action === 'delete') await deleteArticle(id);
        });
    });
}

async function deleteArticle(id) {
    if (!UI.confirm('Удалить статью?')) return;
    try { await api.deleteArticle(id); UI.toast('Удалено', 'success'); loadArticles(); }
    catch (err) { UI.toast(err.message, 'error'); }
}

function renderArtPagination(totalPages, page) {
    const c = document.getElementById('art-pagination');
    if (totalPages <= 1) { c.innerHTML = ''; return; }
    c.innerHTML = `<div style="display:flex;gap:8px;justify-content:center;margin-top:16px;align-items:center;">
        <button class="btn btn-sm btn-secondary" ${page === 1 ? 'disabled' : ''} onclick="changeArtPage(${page - 1})">←</button>
        <span style="font-size:14px;">${page} / ${totalPages}</span>
        <button class="btn btn-sm btn-secondary" ${page === totalPages ? 'disabled' : ''} onclick="changeArtPage(${page + 1})">→</button></div>`;
}
window.changeArtPage = p => { if (p < 1) return; artState.offset = (p - 1) * artState.limit; loadArticles(); };

function addAuthorRow(author, users) {
    const list = document.getElementById('authors-list');
    const userOpts = users.map(u => `<option value="${u.id}" ${author && author.user_id === u.id ? 'selected' : ''}>${UI.escape(u.full_name)}</option>`).join('');
    const row = document.createElement('div');
    row.className = 'author-row';
    row.innerHTML = `<select class="input author-user"><option value="">Внешний автор</option>${userOpts}</select>
        <input type="text" class="input author-name" placeholder="ФИО автора" value="${author ? UI.escape(author.name) : ''}">
        <button type="button" class="btn btn-danger btn-sm author-remove" title="Убрать">✕</button>`;
    list.appendChild(row);
    const select = row.querySelector('.author-user');
    const nameInput = row.querySelector('.author-name');
    select.addEventListener('change', () => { if (select.value) { const u = users.find(x => x.id === select.value); if (u) nameInput.value = u.full_name; } });
    row.querySelector('.author-remove').addEventListener('click', () => row.remove());
}

async function showArticleForm(id = null) {
    let article = { title: '', details: '', indexing: '', white_list_level: '', funding: '', link: '', status: 'planned', authors: [] };
    if (id) { try { article = await api.getArticle(id); } catch (e) { UI.toast(e.message, 'error'); return; } }
    let users = []; try { users = await api.getUsers(); } catch {}

    UI.openModal(id ? 'Редактировать статью' : 'Новая статья', `
        <form id="article-form">
            <div class="form-group"><label>Название публикации <span class="required">*</span></label><textarea class="input" name="title" rows="2" required>${UI.escape(article.title)}</textarea></div>
            <div class="form-group"><label>Авторы <span class="required">*</span></label><div id="authors-list"></div><button type="button" class="btn btn-secondary btn-sm" id="add-author-btn" style="margin-top:8px;">+ Добавить автора</button></div>
            <div class="form-group"><label>Выходные данные</label><textarea class="input" name="details" rows="2" placeholder="Журнал, том, номер, страницы, год...">${UI.escape(article.details || '')}</textarea></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div class="form-group"><label>Индексирование (квартиль)</label><input type="text" class="input" name="indexing" value="${UI.escape(article.indexing || '')}" list="indexing-options" placeholder="Scopus Q1, РИНЦ..."><datalist id="indexing-options"><option value="Scopus Q1"><option value="Scopus Q2"><option value="Scopus Q3"><option value="Scopus Q4"><option value="WoS Q1"><option value="WoS Q2"><option value="РИНЦ"><option value="ВАК"></datalist></div>
                <div class="form-group"><label>Уровень белого списка</label><input type="text" class="input" name="white_list_level" value="${UI.escape(article.white_list_level || '')}" list="wl-options" placeholder="Уровень 1..."><datalist id="wl-options"><option value="Уровень 1"><option value="Уровень 2"><option value="Уровень 3"></datalist></div>
            </div>
            <div class="form-group"><label>Финансирование</label><input type="text" class="input" name="funding" value="${UI.escape(article.funding || '')}" list="funding-options" placeholder="ГЗ, РНФ..."><datalist id="funding-options"><option value="ГЗ"><option value="РНФ"><option value="Без финансирования"></datalist></div>
            <div class="form-group"><label>Ссылка</label><input type="text" class="input" name="link" value="${UI.escape(article.link || '')}" placeholder="https://..."></div>
            <div class="form-group"><label>Статус <span class="required">*</span></label><select class="input" name="status" required><option value="planned" ${article.status === 'planned' ? 'selected' : ''}>План</option><option value="submitted" ${article.status === 'submitted' ? 'selected' : ''}>Подана</option><option value="published" ${article.status === 'published' ? 'selected' : ''}>Вышла</option></select></div>
            <div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Отмена</button><button type="submit" class="btn btn-primary">${id ? 'Сохранить' : 'Создать'}</button></div>
        </form>`);

    document.getElementById('add-author-btn').addEventListener('click', () => addAuthorRow(null, users));
    if (article.authors && article.authors.length) article.authors.forEach(a => addAuthorRow(a, users));
    else addAuthorRow(null, users);

    document.getElementById('article-form').addEventListener('submit', async e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const authors = [];
        document.querySelectorAll('#authors-list .author-row').forEach(row => {
            const userId = row.querySelector('.author-user').value || null;
            const name = row.querySelector('.author-name').value.trim();
            if (name) authors.push({ user_id: userId, name });
        });
        if (!authors.length) { UI.toast('Добавьте хотя бы одного автора', 'error'); return; }
        const payload = {
            title: fd.get('title').trim(), details: fd.get('details').trim() || null, indexing: fd.get('indexing').trim() || null,
            white_list_level: fd.get('white_list_level').trim() || null, funding: fd.get('funding').trim() || null,
            link: fd.get('link').trim() || null, status: fd.get('status'), authors
        };
        try {
            if (id) { await api.updateArticle(id, payload); UI.toast('Обновлено', 'success'); }
            else { await api.createArticle(payload); UI.toast('Создано', 'success'); }
            UI.closeModal();
            if (window.location.hash.match(/#\/article\/view\/\d+/)) renderArticlePage(id);
            else loadArticles();
        } catch (err) { UI.toast(err.message, 'error'); }
    });
}

async function renderArticlePage(id) {
    document.getElementById('app').style.display = 'none';
    let view = document.getElementById('full-page-view');
    if (!view) { view = document.createElement('div'); view.id = 'full-page-view'; document.body.appendChild(view); }
    view.style.display = 'block';
    view.innerHTML = '<div class="ep-loading">Загрузка статьи...</div>';
    window.scrollTo(0, 0);
    try {
        const a = await api.getArticle(id);
        const authorsHtml = (a.authors || []).map((au, i) => `<li class="art-author"><span class="art-author-num">${i + 1}</span><span>${UI.escape(au.name)}</span>${au.user_id ? '<span class="art-author-badge">сотрудник</span>' : ''}</li>`).join('');
        const linkHtml = a.link ? `<a href="${UI.escape(a.link)}" target="_blank" class="ep-doc-link">🔗 ${UI.escape(a.link)}</a>` : '<span class="ep-muted">—</span>';
        view.innerHTML = `<div class="pf-container">
            <div class="ep-topbar"><button class="ep-back" onclick="window.location.hash=''">← К списку статей</button>
                <div style="display:flex;gap:10px;align-items:center;"><button class="btn btn-primary" onclick="showArticleForm(${a.id})">✏️ Редактировать</button><button class="ep-back" onclick="doLogout()">Выйти</button></div></div>
            <div class="ep-header"><div class="ep-id"><span style="background:rgba(255,255,255,0.2);padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">${articleStatusName(a.status)}</span></div><h1 class="ep-title" style="font-size:26px;">${UI.escape(a.title)}</h1></div>
            <div class="pf-grid">
                <div class="ep-card"><h2 class="ep-card-title">Авторы</h2><ul class="art-authors">${authorsHtml || '<li class="text-muted">Не указаны</li>'}</ul></div>
                <div class="ep-card"><h2 class="ep-card-title">Сведения</h2>
                    <div class="ep-fact"><span class="ep-label">Индексирование</span><span class="ep-value">${UI.escape(a.indexing || '—')}</span></div>
                    <div class="ep-fact"><span class="ep-label">Белый список</span><span class="ep-value">${UI.escape(a.white_list_level || '—')}</span></div>
                    <div class="ep-fact"><span class="ep-label">Финансирование</span><span class="ep-value">${UI.escape(a.funding || '—')}</span></div>
                    <div class="ep-fact"><span class="ep-label">Статус</span><span class="ep-value">${articleStatusName(a.status)}</span></div></div>
            </div>
            <div class="ep-card ep-desc-card" style="margin-bottom:20px;"><h2 class="ep-card-title">Выходные данные</h2><p class="ep-desc">${UI.escape(a.details || '—')}</p></div>
            <div class="ep-card" style="margin-bottom:20px;"><h2 class="ep-card-title">Ссылка</h2><div>${linkHtml}</div></div>
            <div class="ep-meta">Создано: ${UI.formatDate(a.created_at)} · Обновлено: ${UI.formatDate(a.updated_at)}</div></div>`;
    } catch (err) {
        view.innerHTML = `<div class="ep-error"><div class="ep-error-icon">⚠️</div><h2>Не удалось загрузить статью</h2><p>${UI.escape(err.message)}</p><button class="btn btn-secondary" onclick="window.location.hash=''">← Вернуться</button></div>`;
    }
}

// ============================================================
// ===================== СТРАНИЦА ПРОФИЛЯ =====================
// ============================================================
const myArtState = { search: '', status: '' };

async function renderProfilePage() {
    document.getElementById('app').style.display = 'none';
    let view = document.getElementById('full-page-view');
    if (!view) { view = document.createElement('div'); view.id = 'full-page-view'; document.body.appendChild(view); }
    view.style.display = 'block';
    view.innerHTML = '<div class="ep-loading">Загрузка профиля...</div>';
    window.scrollTo(0, 0);
    try {
        const me = await api.getMe();
        const avatarSrc = api.avatarUrl(me.id);
        view.innerHTML = `<div class="pf-container">
            <div class="ep-topbar"><button class="ep-back" onclick="window.location.hash=''">← Назад</button>${isAdmin() ? `<button class="btn btn-primary" onclick="window.showUserForm('${me.id}')">✏️ Редактировать</button>` : ''}</div>
            <div class="pf-header">
                <div class="pf-avatar"><img id="pf-avatar-img" src="${avatarSrc}" alt="${UI.escape(me.full_name)}"></div>
                <div class="pf-identity">
                    <div class="pf-role-line"><span class="pf-role">${UI.roleName(me.role)}</span>${me.is_active ? '<span class="pf-active">● активен</span>' : '<span class="pf-inactive">неактивен</span>'}</div>
                    <h1 class="pf-name">${UI.escape(me.full_name)}</h1>
                    ${me.position ? `<div class="pf-position">${UI.escape(me.position)}</div>` : ''}
                    <div class="pf-contacts">${me.email ? `<span>✉️ ${UI.escape(me.email)}</span>` : ''}${me.phone ? `<span>📞 ${UI.escape(me.phone)}</span>` : ''}</div>
                </div>
            </div>
            <div class="pf-grid">
                <div class="ep-card"><h2 class="ep-card-title">Сведения</h2>
                    <div class="ep-fact"><span class="ep-label">Должность</span><span class="ep-value">${UI.escape(me.position || '—')}</span></div>
                    <div class="ep-fact"><span class="ep-label">Роль</span><span class="ep-value">${UI.roleName(me.role)}</span></div>
                    <div class="ep-fact"><span class="ep-label">Email</span><span class="ep-value">${UI.escape(me.email || '—')}</span></div>
                    <div class="ep-fact"><span class="ep-label">Телефон</span><span class="ep-value">${UI.escape(me.phone || '—')}</span></div>
                    <div class="ep-fact"><span class="ep-label">В системе с</span><span class="ep-value">${UI.formatDate(me.created_at)}</span></div>
                    <div class="ep-fact"><span class="ep-label">ID</span><span class="ep-value" style="font-size:11px;">${me.id}</span></div>
                </div>
                <div class="ep-card"><h2 class="ep-card-title">Сервисы</h2>
                    <div class="pf-service pf-service-clickable" onclick="window.location.hash='#/my-articles'">
                        <span class="pf-service-icon">📚</span><div class="pf-service-body"><div class="pf-service-name">Мои публикации</div><div class="pf-service-desc">Статьи, где я автор или соавтор</div></div><span class="pf-service-arrow">→</span>
                    </div>
                    <div class="pf-service"><span class="pf-service-icon">📅</span><div class="pf-service-body"><div class="pf-service-name">Расписание</div><div class="pf-service-desc">Пары и консультации</div></div><span class="pf-soon">скоро</span></div>
                    <div class="pf-service"><span class="pf-service-icon">🔑</span><div class="pf-service-body"><div class="pf-service-name">Мои ключи</div><div class="pf-service-desc">Ключи на руках и история</div></div><span class="pf-soon">скоро</span></div>
                </div>
            </div></div>`;
        const img = document.getElementById('pf-avatar-img');
        img.addEventListener('error', () => { const span = document.createElement('span'); span.className = 'pf-initials'; span.textContent = initials(me.full_name); img.replaceWith(span); });
    } catch (err) {
        view.innerHTML = `<div class="ep-error"><div class="ep-error-icon">⚠️</div><h2>Не удалось загрузить профиль</h2><p>${UI.escape(err.message)}</p><button class="btn btn-secondary" onclick="window.location.hash=''">← Вернуться</button></div>`;
    }
}

async function renderUserProfilePage(userId) {
    document.getElementById('app').style.display = 'none';
    let view = document.getElementById('full-page-view');
    if (!view) { view = document.createElement('div'); view.id = 'full-page-view'; document.body.appendChild(view); }
    view.style.display = 'block';
    view.innerHTML = '<div class="ep-loading">Загрузка профиля...</div>';
    window.scrollTo(0, 0);
    try {
        const user = await api.getUser(userId);
        const avatarSrc = api.avatarUrl(user.id);
        view.innerHTML = `<div class="pf-container">
            <div class="ep-topbar"><button class="ep-back" onclick="window.location.hash='#/users'">← Назад</button>${isAdmin() ? `<button class="btn btn-primary" onclick="window.showUserForm('${user.id}')">✏️ Редактировать</button>` : ''}</div>
            <div class="pf-header">
                <div class="pf-avatar"><img id="pf-avatar-img" src="${avatarSrc}" alt="${UI.escape(user.full_name)}"></div>
                <div class="pf-identity">
                    <div class="pf-role-line"><span class="pf-role">${UI.roleName(user.role)}</span>${user.is_active ? '<span class="pf-active">● активен</span>' : '<span class="pf-inactive">неактивен</span>'}</div>
                    <h1 class="pf-name">${UI.escape(user.full_name)}</h1>
                    ${user.position ? `<div class="pf-position">${UI.escape(user.position)}</div>` : ''}
                    <div class="pf-contacts">${user.email ? `<span>✉️ ${UI.escape(user.email)}</span>` : ''}${user.phone ? `<span>📞 ${UI.escape(user.phone)}</span>` : ''}</div>
                </div>
            </div>
            <div class="pf-grid">
                <div class="ep-card"><h2 class="ep-card-title">Сведения</h2>
                    <div class="ep-fact"><span class="ep-label">Должность</span><span class="ep-value">${UI.escape(user.position || '—')}</span></div>
                    <div class="ep-fact"><span class="ep-label">Роль</span><span class="ep-value">${UI.roleName(user.role)}</span></div>
                    <div class="ep-fact"><span class="ep-label">Email</span><span class="ep-value">${UI.escape(user.email || '—')}</span></div>
                    <div class="ep-fact"><span class="ep-label">Телефон</span><span class="ep-value">${UI.escape(user.phone || '—')}</span></div>
                    <div class="ep-fact"><span class="ep-label">В системе с</span><span class="ep-value">${UI.formatDate(user.created_at)}</span></div>
                    <div class="ep-fact"><span class="ep-label">ID</span><span class="ep-value" style="font-size:11px;">${user.id}</span></div>
                </div>
                <div class="ep-card"><h2 class="ep-card-title">Сервисы</h2>
                    <div class="pf-service pf-service-clickable" onclick="window.location.hash='#/my-articles/${user.id}'">
                        <span class="pf-service-icon">📚</span><div class="pf-service-body"><div class="pf-service-name">Публикации</div><div class="pf-service-desc">Статьи, где пользователь автор или соавтор</div></div><span class="pf-service-arrow">→</span>
                    </div>
                    <div class="pf-service"><span class="pf-service-icon">📅</span><div class="pf-service-body"><div class="pf-service-name">Расписание</div><div class="pf-service-desc">Пары и консультации</div></div><span class="pf-soon">скоро</span></div>
                    <div class="pf-service"><span class="pf-service-icon">🔑</span><div class="pf-service-body"><div class="pf-service-name">Ключи</div><div class="pf-service-desc">Ключи на руках и история</div></div><span class="pf-soon">скоро</span></div>
                </div>
            </div></div>`;
        const img = document.getElementById('pf-avatar-img');
        img.addEventListener('error', () => { const span = document.createElement('span'); span.className = 'pf-initials'; span.textContent = initials(user.full_name); img.replaceWith(span); });
    } catch (err) {
        view.innerHTML = `<div class="ep-error"><div class="ep-error-icon">⚠️</div><h2>Не удалось загрузить профиль</h2><p>${UI.escape(err.message)}</p><button class="btn btn-secondary" onclick="window.history.back()">← Вернуться</button></div>`;
    }
}

async function renderMyArticlesPage() {
    document.getElementById('app').style.display = 'none';
    let view = document.getElementById('full-page-view');
    if (!view) { view = document.createElement('div'); view.id = 'full-page-view'; document.body.appendChild(view); }
    view.style.display = 'block';
    view.innerHTML = '<div class="ep-loading">Загрузка публикаций...</div>';
    window.scrollTo(0, 0);
    try {
        const me = await api.getMe();
        const data = await api.getArticles({ author_id: me.id, limit: 100 });
        const allArticles = data.articles || [];
        
        // Фильтрация
        let articles = allArticles;
        if (myArtState.search) {
            const s = myArtState.search.toLowerCase();
            articles = articles.filter(a => (a.title || '').toLowerCase().includes(s));
        }
        if (myArtState.status) {
            articles = articles.filter(a => a.status === myArtState.status);
        }
        
        const listHtml = articles.length ? articles.map((a, i) => {
            const authors = (a.authors || []).map(x => x.name).join(', ');
            return `<div class="my-art-card" onclick="window.location.hash='#/article/view/${a.id}'">
                <div class="my-art-num">${i + 1}</div>
                <div class="my-art-body">
                    <div class="my-art-title">${UI.escape(a.title)}</div>
                    <div class="my-art-authors">${UI.escape(authors)}</div>
                    <div class="my-art-meta">${a.details ? `<span>📖 ${UI.escape(a.details)}</span>` : ''}${a.indexing ? `<span>📊 ${UI.escape(a.indexing)}</span>` : ''}${a.funding ? `<span>💰 ${UI.escape(a.funding)}</span>` : ''}</div>
                </div>
                <span class="badge badge-${a.status}">${articleStatusName(a.status)}</span></div>`;
        }).join('') : `<div class="my-art-empty"><div class="my-art-empty-icon">📚</div><h3>У вас пока нет публикаций</h3><p>Добавьте свою первую статью в разделе «Статьи»</p><button class="btn btn-primary" onclick="window.location.hash='';document.querySelector('[data-page=articles]').click()">Перейти к статьям</button></div>`;

        view.innerHTML = `<div class="pf-container">
            <div class="ep-topbar"><button class="ep-back" onclick="window.location.hash='#/profile'">← В профиль</button><button class="btn btn-primary" onclick="showArticleForm()">+ Добавить статью</button></div>
            <div class="ep-header" style="background:linear-gradient(135deg, #0f766e 0%, #14b8a6 100%);">
                <div class="ep-id">МОИ ПУБЛИКАЦИИ</div><h1 class="ep-title" style="font-size:28px;">${UI.escape(me.full_name)}</h1>
                <div class="ep-quick"><span>📚 Всего статей: ${allArticles.length}</span><span>👤 ${UI.escape(me.position || UI.roleName(me.role))}</span></div></div>
            <div class="my-art-filters" style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
                <input type="text" id="myart-search" class="input" placeholder="Поиск по названию..." style="width:220px;" value="${UI.escape(myArtState.search)}">
                <select id="myart-status-filter" class="input" style="width:150px;">
                    <option value="">Все статусы</option>
                    <option value="planned" ${myArtState.status === 'planned' ? 'selected' : ''}>План</option>
                    <option value="submitted" ${myArtState.status === 'submitted' ? 'selected' : ''}>Подана</option>
                    <option value="published" ${myArtState.status === 'published' ? 'selected' : ''}>Вышла</option>
                </select>
            </div>
            <div class="my-art-list">${listHtml}</div></div>`;
        
        // Обработчики фильтров
        let t;
        document.getElementById('myart-search').addEventListener('input', e => {
            clearTimeout(t); t = setTimeout(() => { myArtState.search = e.target.value; renderMyArticlesPage(); }, 300);
        });
        document.getElementById('myart-status-filter').addEventListener('change', e => { myArtState.status = e.target.value; renderMyArticlesPage(); });
    } catch (err) {
        view.innerHTML = `<div class="ep-error"><div class="ep-error-icon">⚠️</div><h2>Не удалось загрузить публикации</h2><p>${UI.escape(err.message)}</p><button class="btn btn-secondary" onclick="window.location.hash='#/profile'">← В профиль</button></div>`;
    }
}

async function renderUserArticlesPage(userId) {
    document.getElementById('app').style.display = 'none';
    let view = document.getElementById('full-page-view');
    if (!view) { view = document.createElement('div'); view.id = 'full-page-view'; document.body.appendChild(view); }
    view.style.display = 'block';
    view.innerHTML = '<div class="ep-loading">Загрузка публикаций...</div>';
    window.scrollTo(0, 0);
    try {
        const user = await api.getUser(userId);
        const data = await api.getArticles({ author_id: userId, limit: 100 });
        const allArticles = data.articles || [];
        
        // Фильтрация
        let articles = allArticles;
        if (myArtState.search) {
            const s = myArtState.search.toLowerCase();
            articles = articles.filter(a => (a.title || '').toLowerCase().includes(s));
        }
        if (myArtState.status) {
            articles = articles.filter(a => a.status === myArtState.status);
        }
        
        const listHtml = articles.length ? articles.map((a, i) => {
            const authors = (a.authors || []).map(x => x.name).join(', ');
            return `<div class="my-art-card" onclick="window.location.hash='#/article/view/${a.id}'">
                <div class="my-art-num">${i + 1}</div>
                <div class="my-art-body">
                    <div class="my-art-title">${UI.escape(a.title)}</div>
                    <div class="my-art-authors">${UI.escape(authors)}</div>
                    <div class="my-art-meta">${a.details ? `<span>📖 ${UI.escape(a.details)}</span>` : ''}${a.indexing ? `<span>📊 ${UI.escape(a.indexing)}</span>` : ''}${a.funding ? `<span>💰 ${UI.escape(a.funding)}</span>` : ''}</div>
                </div>
                <span class="badge badge-${a.status}">${articleStatusName(a.status)}</span></div>`;
        }).join('') : `<div class="my-art-empty"><div class="my-art-empty-icon">📚</div><h3>У пользователя нет публикаций</h3><p>Публикации этого автора отсутствуют в системе</p></div>`;

        view.innerHTML = `<div class="pf-container">
            <div class="ep-topbar"><button class="ep-back" onclick="window.location.hash='#/user/${userId}'">← В профиль</button></div>
            <div class="ep-header" style="background:linear-gradient(135deg, #0f766e 0%, #14b8a6 100%);">
                <div class="ep-id">ПУБЛИКАЦИИ</div><h1 class="ep-title" style="font-size:28px;">${UI.escape(user.full_name)}</h1>
                <div class="ep-quick"><span>📚 Всего статей: ${allArticles.length}</span><span>👤 ${UI.escape(user.position || UI.roleName(user.role))}</span></div></div>
            <div class="my-art-filters" style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
                <input type="text" id="myart-search" class="input" placeholder="Поиск по названию..." style="width:220px;" value="${UI.escape(myArtState.search)}">
                <select id="myart-status-filter" class="input" style="width:150px;">
                    <option value="">Все статусы</option>
                    <option value="planned" ${myArtState.status === 'planned' ? 'selected' : ''}>План</option>
                    <option value="submitted" ${myArtState.status === 'submitted' ? 'selected' : ''}>Подана</option>
                    <option value="published" ${myArtState.status === 'published' ? 'selected' : ''}>Вышла</option>
                </select>
            </div>
            <div class="my-art-list">${listHtml}</div></div>`;
        
        // Обработчики фильтров
        let t;
        document.getElementById('myart-search').addEventListener('input', e => {
            clearTimeout(t); t = setTimeout(() => { myArtState.search = e.target.value; renderUserArticlesPage(userId); }, 300);
        });
        document.getElementById('myart-status-filter').addEventListener('change', e => { myArtState.status = e.target.value; renderUserArticlesPage(userId); });
    } catch (err) {
        view.innerHTML = `<div class="ep-error"><div class="ep-error-icon">⚠️</div><h2>Не удалось загрузить публикации</h2><p>${UI.escape(err.message)}</p><button class="btn btn-secondary" onclick="window.location.hash='#/user/${userId}'">← В профиль</button></div>`;
    }
}

// ============================================================
// ======================= КЛЮЧИ ==============================
// ============================================================
function initKeysPage() {
    document.getElementById('btn-add-key').addEventListener('click', () => showKeyForm());
    document.getElementById('key-status-filter').addEventListener('change', e => loadKeys(e.target.value));
}

async function loadKeys(status = '') {
    const tbody = document.getElementById('keys-table-body');
    tbody.innerHTML = '<tr><td colspan="6" class="loading">Загрузка...</td></tr>';
    try {
        const keys = await api.getKeys(status);
        if (!keys.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Не найдено</td></tr>'; return; }
        const rows = await Promise.all(keys.map(async key => {
            let holder = '—';
            if (key.status === 'issued') {
                try { const h = await api.getKeyHolder(key.id); if (h && h.user_id) { const u = await api.getUser(h.user_id); holder = u ? u.full_name : h.user_id.slice(0, 8); } } catch {}
            }
            const adminBtns = isAdmin() ? `
                ${key.status === 'available' ? `<button class="btn btn-success btn-sm" data-action="issue" data-id="${key.id}">Выдать</button>` : ''}
                ${key.status === 'issued' ? `<button class="btn btn-warning btn-sm" data-action="return" data-id="${key.id}">Вернуть</button><button class="btn btn-danger btn-sm" data-action="lost" data-id="${key.id}">Утерян</button>` : ''}
                <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${key.id}">✏️</button>` : `
                ${key.status === 'available' ? `<button class="btn btn-success btn-sm" data-action="issue" data-id="${key.id}">Выдать</button>` : ''}
                ${key.status === 'issued' ? `<button class="btn btn-warning btn-sm" data-action="return" data-id="${key.id}">Вернуть</button>` : ''}`;
            return `<tr><td>${key.id}</td><td><strong>${UI.escape(key.key_number)}</strong></td><td>${UI.escape(key.room_description)}</td>
                <td><span class="badge badge-${key.status}">${UI.statusName(key.status)}</span></td><td>${UI.escape(holder)}</td>
                <td class="actions-cell">${adminBtns}<button class="btn btn-secondary btn-sm" data-action="history" data-id="${key.id}">📋</button></td></tr>`;
        }));
        tbody.innerHTML = rows.join('');
        document.querySelectorAll('#keys-table-body [data-action]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.dataset.id);
                const a = btn.dataset.action;
                if (a === 'issue') await showIssueForm(id);
                if (a === 'return') { if (UI.confirm('Вернуть ключ?')) { try { await api.returnKey(id, { comment: 'Возврат' }); UI.toast('Возвращён', 'success'); loadKeys(status); } catch (e) { UI.toast(e.message, 'error'); } } }
                if (a === 'lost') { if (UI.confirm('Утерян?')) { try { await api.markLost(id, { comment: 'Утеря' }); UI.toast('Помечен', 'success'); loadKeys(status); } catch (e) { UI.toast(e.message, 'error'); } } }
                if (a === 'history') await showKeyHistory(id);
                if (a === 'edit') await showKeyForm(id);
            });
        });
    } catch (err) { tbody.innerHTML = `<tr><td colspan="6" class="empty-state">${UI.escape(err.message)}</td></tr>`; }
}

async function showKeyForm(id = null) {
    let key = { key_number: '', room_description: '', notes: '', status: 'available' };
    if (id) { try { key = await api.getKey(id); } catch (e) { UI.toast(e.message, 'error'); return; } }
    UI.openModal(id ? 'Редактировать ключ' : 'Новый ключ', `
        <form id="key-form">
            <div class="form-group"><label>Номер <span class="required">*</span></label><input type="text" class="input" name="key_number" value="${UI.escape(key.key_number)}" required></div>
            <div class="form-group"><label>Помещение <span class="required">*</span></label><input type="text" class="input" name="room_description" value="${UI.escape(key.room_description)}" required></div>
            <div class="form-group"><label>Примечания</label><input type="text" class="input" name="notes" value="${UI.escape(key.notes || '')}"></div>
            ${id ? `<div class="form-group"><label>Статус</label><select class="input" name="status"><option value="available" ${key.status === 'available' ? 'selected' : ''}>Свободен</option><option value="issued" ${key.status === 'issued' ? 'selected' : ''}>Выдан</option><option value="lost" ${key.status === 'lost' ? 'selected' : ''}>Утерян</option></select></div>` : ''}
            <div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Отмена</button><button type="submit" class="btn btn-primary">${id ? 'Сохранить' : 'Создать'}</button></div>
        </form>`);
    document.getElementById('key-form').addEventListener('submit', async e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = { key_number: fd.get('key_number').trim(), room_description: fd.get('room_description').trim(), notes: fd.get('notes').trim() || null };
        if (id) data.status = fd.get('status');
        try {
            if (id) { await api.updateKey(id, data); UI.toast('Обновлён', 'success'); }
            else { await api.createKey(data); UI.toast('Создан', 'success'); }
            UI.closeModal(); loadKeys(document.getElementById('key-status-filter').value);
        } catch (err) { UI.toast(err.message, 'error'); }
    });
}

async function showIssueForm(keyId) {
    let users = []; try { users = await api.getUsers(); } catch (e) { UI.toast(e.message, 'error'); return; }
    if (!users.length) { UI.toast('Нет пользователей', 'error'); return; }
    const opts = users.map(u => `<option value="${u.id}">${UI.escape(u.full_name)} (${UI.roleName(u.role)})</option>`).join('');
    UI.openModal('Выдача ключа', `<form id="issue-form">
        <div class="form-group"><label>Кому <span class="required">*</span></label><select class="input" name="user_id" required><option value="">Выберите...</option>${opts}</select></div>
        <div class="form-group"><label>Комментарий</label><input type="text" class="input" name="comment"></div>
        <div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Отмена</button><button type="submit" class="btn btn-success">Выдать</button></div></form>`);
    document.getElementById('issue-form').addEventListener('submit', async e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try { await api.issueKey(keyId, { user_id: fd.get('user_id'), comment: fd.get('comment').trim() || null }); UI.toast('Выдан', 'success'); UI.closeModal(); loadKeys(document.getElementById('key-status-filter').value); }
        catch (err) { UI.toast(err.message, 'error'); }
    });
}

async function showKeyHistory(keyId) {
    let logs = []; try { logs = await api.getKeyHistory(keyId); } catch (e) { UI.toast(e.message, 'error'); return; }
    if (!logs.length) { UI.openModal(`История #${keyId}`, '<div class="empty-state">Пуста</div>'); return; }
    const items = await Promise.all(logs.map(async log => {
        let name = 'Система'; if (log.user_id) { try { const u = await api.getUser(log.user_id); if (u) name = u.full_name; } catch {} }
        return `<li class="history-item"><div><div class="history-action">${UI.actionName(log.action_type)}</div><div>${UI.escape(name)}</div>${log.comment ? `<div class="history-time">💬 ${UI.escape(log.comment)}</div>` : ''}</div><div class="history-time">${UI.formatDate(log.timestamp)}</div></li>`;
    }));
    UI.openModal(`История ключа #${keyId}`, `<ul class="history-list">${items.join('')}</ul>`);
}

// ============================================================
// ==================== ПОЛЬЗОВАТЕЛИ ==========================
// ============================================================
function initUsersPage() { document.getElementById('btn-add-user').addEventListener('click', () => window.showUserForm()); }

async function loadUsers() {
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = '<tr><td colspan="6" class="loading">Загрузка...</td></tr>';
    try {
        const users = await api.getUsers();
        if (!users.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Не найдено</td></tr>'; return; }
        tbody.innerHTML = users.map(u => `<tr style="cursor:pointer;" data-user-id="${u.id}">
            <td><strong>${UI.escape(u.full_name)}</strong>${u.position ? `<div class="text-muted" style="font-size:12px;">${UI.escape(u.position)}</div>` : ''}</td>
            <td><span class="badge badge-role">${UI.roleName(u.role)}</span></td>
            <td>${UI.escape(u.phone || '—')}</td><td>${UI.escape(u.email || '—')}</td>
            <td>${u.is_active ? '<span class="badge badge-available">Активен</span>' : '<span class="badge badge-lost">Неактивен</span>'}</td>
            <td class="actions-cell">${isAdmin() ? `<button class="btn btn-secondary btn-sm" data-action="edit" data-id="${u.id}">✏️</button><button class="btn btn-danger btn-sm" data-action="deactivate" data-id="${u.id}">🚫</button>` : '—'}</td></tr>`).join('');
        
        // Обработчик клика на строку пользователя
        document.querySelectorAll('#users-table-body tr[data-user-id]').forEach(row => {
            row.addEventListener('click', e => {
                // Игнорируем клики по кнопкам действий
                if (e.target.closest('[data-action]')) return;
                const userId = row.dataset.userId;
                window.location.hash = `#/user/${userId}`;
            });
        });
        
        if (isAdmin()) {
            document.querySelectorAll('#users-table-body [data-action]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.dataset.id;
                    if (btn.dataset.action === 'edit') await window.showUserForm(id);
                    if (btn.dataset.action === 'deactivate' && UI.confirm('Деактивировать?')) {
                        try { await api.deactivateUser(id); UI.toast('Деактивирован', 'success'); loadUsers(); }
                        catch (e) { UI.toast(e.message, 'error'); }
                    }
                });
            });
        }
    } catch (err) { tbody.innerHTML = `<tr><td colspan="6" class="empty-state">${UI.escape(err.message)}</td></tr>`; }
}

window.showUserForm = async function(id = null) {
    let user = { full_name: '', role: 'student', position: '', phone: '', email: '' };
    if (id) { try { user = await api.getUser(id); } catch (e) { UI.toast(e.message, 'error'); return; } }
    const avatarBlock = id ? `<div class="form-group"><label>Аватар</label><div class="avatar-editor"><div class="avatar-preview" id="avatar-preview"></div><div class="avatar-controls">
        <label class="btn btn-secondary btn-sm" style="cursor:pointer;">📷 Загрузить<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" style="display:none" onchange="uploadUserAvatarFromFile('${id}', this)"></label>
        <button type="button" class="btn btn-danger btn-sm" onclick="deleteUserAvatarFromForm('${id}')">Удалить</button></div></div></div>` : `<div class="form-group"><label>Аватар</label><small class="text-muted">Можно добавить после создания пользователя</small></div>`;

    UI.openModal(id ? 'Редактировать пользователя' : 'Новый пользователь', `<form id="user-form">
        <div class="form-group"><label>ФИО <span class="required">*</span></label><input type="text" class="input" name="full_name" value="${UI.escape(user.full_name)}" required minlength="3"></div>
        <div class="form-group"><label>Роль <span class="required">*</span></label><select class="input" name="role" required><option value="student" ${user.role === 'student' ? 'selected' : ''}>Студент</option><option value="teacher" ${user.role === 'teacher' ? 'selected' : ''}>Преподаватель</option><option value="staff" ${user.role === 'staff' ? 'selected' : ''}>Сотрудник</option><option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Админ</option></select></div>
        <div class="form-group"><label>Должность</label><input type="text" class="input" name="position" value="${UI.escape(user.position || '')}" placeholder="Напр. доцент, лаборант..."></div>
        <div class="form-group"><label>Телефон</label><input type="tel" class="input" name="phone" value="${UI.escape(user.phone || '')}"></div>
        <div class="form-group"><label>Email</label><input type="email" class="input" name="email" value="${UI.escape(user.email || '')}"></div>
        ${avatarBlock}
        ${!id ? `<div class="form-group"><label>Пароль</label><input type="password" class="input" name="password" minlength="8" placeholder="Мин. 8 символов (опционально)"><small class="text-muted">Если не указан — пользователь создаётся без пароля</small></div>` : ''}
        <div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Отмена</button><button type="submit" class="btn btn-primary">${id ? 'Сохранить' : 'Создать'}</button></div></form>`);

    if (id) renderAvatarPreview(user);

    document.getElementById('user-form').addEventListener('submit', async e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = { full_name: fd.get('full_name').trim(), role: fd.get('role'), position: fd.get('position').trim() || null, phone: fd.get('phone').trim() || null, email: fd.get('email').trim() || null };
        if (!id) { const pwd = fd.get('password'); if (pwd) data.password = pwd; }
        try {
            if (id) { await api.updateUser(id, data); UI.toast('Обновлён', 'success'); }
            else { await api.createUser(data); UI.toast('Создан', 'success'); }
            UI.closeModal();
            if (window.location.hash === '#/profile') { renderProfilePage(); renderHeaderUser(); }
            else loadUsers();
        } catch (err) { UI.toast(err.message, 'error'); }
    });
}

function renderAvatarPreview(user) {
    const container = document.getElementById('avatar-preview');
    if (!container) return;

    const src = (user.avatar && user.avatar.includes('/api/v1/avatars/'))
        ? user.avatar
        : api.avatarUrl(user.id);

    container.innerHTML = `<img src="${src}" alt="">`;
    const img = container.querySelector('img');
    img.addEventListener('error', () => {
        const span = document.createElement('span');
        span.className = 'avatar-preview-initials';
        span.textContent = initials(user.full_name);
        img.replaceWith(span);
    });
}

window.uploadUserAvatarFromFile = async function(userId, input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { 
        UI.toast('Файл слишком большой (макс. 5 МБ)', 'error'); 
        input.value = ''; 
        return; 
    }
    try {
        await api.uploadUserAvatar(userId, file);
        UI.toast('Аватар обновлён', 'success');

        const freshUrl = api.avatarUrl(userId) + '?v=' + Date.now();

        const container = document.getElementById('avatar-preview');
        if (container) {
            container.innerHTML = `<img src="${freshUrl}" alt="">`;
            const img = container.querySelector('img');
            
            img.addEventListener('error', async () => {
                const span = document.createElement('span');
                span.className = 'avatar-preview-initials';
                try {
                    const u = await api.getUser(userId);
                    span.textContent = initials(u.full_name);
                } catch {
                    span.textContent = '??';
                }
                img.replaceWith(span);
            });
        }

        renderHeaderUser();
        if (window.location.hash === '#/profile') renderProfilePage();
    } catch (err) { 
        UI.toast(err.message, 'error'); 
    } finally { 
        input.value = ''; 
    }
};

window.deleteUserAvatarFromForm = async function(userId) {
    if (!UI.confirm('Удалить аватар?')) return;
    try {
        await api.deleteUserAvatar(userId);
        UI.toast('Аватар удалён', 'success');
        const u = await api.getUser(userId);
        renderAvatarPreview(u); renderHeaderUser();
        if (window.location.hash === '#/profile') renderProfilePage();
    } catch (err) { UI.toast(err.message, 'error'); }
};