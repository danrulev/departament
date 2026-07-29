const API_BASE = '/api/v1';

class ApiClient {
    constructor(baseURL) {
        this.baseURL = baseURL;
        this.accessToken = null;
        this._refreshing = null;
    }

    setToken(token) { this.accessToken = token; }
    clearToken()    { this.accessToken = null; }
    isLoggedIn()    { return !!this.accessToken; }

    parseToken() {
        if (!this.accessToken) return null;
        try {
            const payload = JSON.parse(
                atob(this.accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
            );
            if (typeof payload.sub === 'object' && payload.sub !== null) {
                return { userId: payload.sub.UserID, role: payload.sub.Role };
            }
            return { userId: payload.sub, role: payload.role };
        } catch {
            return null;
        }
    }

    async request(endpoint, options = {}, _isRetry = false) {
        const url = `${this.baseURL}${endpoint}`;
        const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };

        if (this.accessToken) {
            headers['Authorization'] = `Bearer ${this.accessToken}`;
        }

        try {
            const response = await fetch(url, {
                credentials: 'include',
                ...options,
                headers,
            });

            if (response.status === 401 && !_isRetry) {
                const refreshed = await this.refresh();
                if (refreshed) {
                    return this.request(endpoint, options, true);
                }
                this.clearToken();
                window.dispatchEvent(new Event('auth:logout'));
                throw new Error('Сессия истекла');
            }

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.error || `Ошибка ${response.status}`);
            }
            return data;
        } catch (error) {
            if (error.name === 'TypeError') {
                throw new Error('Не удалось подключиться к серверу');
            }
            throw error;
        }
    }

    async refresh() {
        if (this._refreshing) return this._refreshing;

        this._refreshing = (async () => {
            try {
                const res = await fetch(`${this.baseURL}/auth/refresh`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                });
                if (!res.ok) return false;
                const data = await res.json();
                if (data.access_token) {
                    this.setToken(data.access_token);
                    return true;
                }
                return false;
            } catch {
                return false;
            } finally {
                this._refreshing = null;
            }
        })();

        return this._refreshing;
    }

    // ─── Auth ───
    async signIn(email, password) {
        const data = await this.request('/auth/signin', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        this.setToken(data.access_token);
        return this.parseToken();
    }

    async logout() {
        try { await this.request('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
        this.clearToken();
    }

    // ─── Profile ───
    getMe() { return this.request('/me'); }
    avatarUrl(userId) { return `${this.baseURL}/avatars/${userId}`; }

    // ─── Users ───
    getUsers()           { return this.request('/users'); }
    getUser(id)          { return this.request(`/users/${id}`); }
    createUser(data)     { return this.request('/users', { method: 'POST', body: JSON.stringify(data) }); }
    updateUser(id, data) { return this.request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
    deactivateUser(id)   { return this.request(`/users/${id}`, { method: 'DELETE' }); }
    getUserHistory(id)   { return this.request(`/users/${id}/history`); }
    deleteUserAvatar(userId) { return this.request(`/users/${userId}/avatar`, { method: 'DELETE' }); }

    async uploadUserAvatar(userId, file, _isRetry = false) {
        const formData = new FormData();
        formData.append('avatar', file);
        const headers = {};
        if (this.accessToken) headers['Authorization'] = `Bearer ${this.accessToken}`;

        const res = await fetch(`${this.baseURL}/users/${userId}/avatar`, {
            method: 'POST', credentials: 'include', headers, body: formData,
        });
        if (res.status === 401 && !_isRetry) {
            const refreshed = await this.refresh();
            if (refreshed) return this.uploadUserAvatar(userId, file, true);
            this.clearToken();
            window.dispatchEvent(new Event('auth:logout'));
            throw new Error('Сессия истекла');
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
        return data;
    }

    // ─── Keys ───
    getKeys(status = '') { return this.request(`/keys${status ? '?status=' + status : ''}`); }
    getKey(id)           { return this.request(`/keys/${id}`); }
    createKey(data)      { return this.request('/keys', { method: 'POST', body: JSON.stringify(data) }); }
    updateKey(id, data)  { return this.request(`/keys/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
    issueKey(id, data)   { return this.request(`/keys/${id}/issue`, { method: 'POST', body: JSON.stringify(data) }); }
    returnKey(id, data)  { return this.request(`/keys/${id}/return`, { method: 'POST', body: JSON.stringify(data) }); }
    markLost(id, data)   { return this.request(`/keys/${id}/lost`, { method: 'POST', body: JSON.stringify(data) }); }
    getKeyHistory(id)    { return this.request(`/keys/${id}/history`); }
    getKeyHolder(id)     { return this.request(`/keys/${id}/holder`); }

    // ─── Equipment ───
    getEquipment(params = {}) {
        const q = new URLSearchParams();
        if (params.limit)     q.append('limit', params.limit);
        if (params.offset)    q.append('offset', params.offset);
        if (params.search)    q.append('search', params.search);
        if (params.inventory) q.append('inventory', params.inventory);
        if (params.status)    q.append('status', params.status);
        const qs = q.toString();
        return this.request(`/equipment${qs ? '?' + qs : ''}`);
    }
    getEquipmentById(id)         { return this.request(`/equipment/${id}`); }
    createEquipment(data)        { return this.request('/equipment', { method: 'POST', body: JSON.stringify(data) }); }
    updateEquipment(id, data)    { return this.request(`/equipment/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
    deleteEquipment(id)          { return this.request(`/equipment/${id}`, { method: 'DELETE' }); }
    getExpiredVerification(l, o) { return this.request(`/equipment/expired-verification?limit=${l}&offset=${o}`); }

    // ─── Photos ───
    getPhotos(equipmentId) { return this.request(`/equipment/${equipmentId}/photos`); }
    deletePhoto(photoId)   { return this.request(`/photos/${photoId}`, { method: 'DELETE' }); }
    photoUrl(photoId)      { return `${this.baseURL}/photos/${photoId}`; }

    async uploadPhoto(equipmentId, file, _isRetry = false) {
        const formData = new FormData();
        formData.append('photo', file);

        const headers = {};
        if (this.accessToken) headers['Authorization'] = `Bearer ${this.accessToken}`;

        const res = await fetch(`${this.baseURL}/equipment/${equipmentId}/photos`, {
            method: 'POST',
            credentials: 'include',
            headers,
            body: formData,
        });

        if (res.status === 401 && !_isRetry) {
            const refreshed = await this.refresh();
            if (refreshed) return this.uploadPhoto(equipmentId, file, true);
            this.clearToken();
            window.dispatchEvent(new Event('auth:logout'));
            throw new Error('Сессия истекла');
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
        return data;
    }

    // ─── Articles ───
    getArticles(params = {}) {
        const q = new URLSearchParams();
        if (params.limit)     q.append('limit', params.limit);
        if (params.offset)    q.append('offset', params.offset);
        if (params.search)    q.append('search', params.search);
        if (params.status)    q.append('status', params.status);
        if (params.author_id) q.append('author_id', params.author_id); // ← НОВОЕ
        const qs = q.toString();
        return this.request(`/articles${qs ? '?' + qs : ''}`);
    }
    getArticle(id)          { return this.request(`/articles/${id}`); }
    createArticle(data)     { return this.request('/articles', { method: 'POST', body: JSON.stringify(data) }); }
    updateArticle(id, data) { return this.request(`/articles/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
    deleteArticle(id)       { return this.request(`/articles/${id}`, { method: 'DELETE' }); }
}

const api = new ApiClient(API_BASE);