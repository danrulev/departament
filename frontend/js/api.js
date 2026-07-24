const API_BASE = '/api/v1';

class ApiClient {
    constructor(baseURL) {
        this.baseURL = baseURL;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        try {
            const response = await fetch(url, {
                headers: { 'Content-Type': 'application/json' },
                ...options,
            });
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

    // ===== Users =====
    getUsers()                          { return this.request('/users'); }
    getUser(id)                         { return this.request(`/users/${id}`); }
    createUser(data)                    { return this.request('/users', { method: 'POST', body: JSON.stringify(data) }); }
    updateUser(id, data)                { return this.request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
    deactivateUser(id)                  { return this.request(`/users/${id}`, { method: 'DELETE' }); }
    getUserHistory(id)                  { return this.request(`/users/${id}/history`); }

    // ===== Keys =====
    getKeys(status = '')                { return this.request(`/keys${status ? '?status=' + status : ''}`); }
    getKey(id)                          { return this.request(`/keys/${id}`); }
    createKey(data)                     { return this.request('/keys', { method: 'POST', body: JSON.stringify(data) }); }
    updateKey(id, data)                 { return this.request(`/keys/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
    issueKey(id, data)                  { return this.request(`/keys/${id}/issue`, { method: 'POST', body: JSON.stringify(data) }); }
    returnKey(id, data)                 { return this.request(`/keys/${id}/return`, { method: 'POST', body: JSON.stringify(data) }); }
    markLost(id, data)                  { return this.request(`/keys/${id}/lost`, { method: 'POST', body: JSON.stringify(data) }); }
    getKeyHistory(id)                   { return this.request(`/keys/${id}/history`); }
    getKeyHolder(id)                    { return this.request(`/keys/${id}/holder`); }

    // ===== Equipment =====
    getEquipment(params = {}) {
        const q = new URLSearchParams();
        if (params.limit)    q.append('limit', params.limit);
        if (params.offset)   q.append('offset', params.offset);
        if (params.search)   q.append('search', params.search);
        if (params.inventory) q.append('inventory', params.inventory);
        if (params.status !== undefined && params.status !== '') q.append('status', params.status);
        const qs = q.toString();
        return this.request(`/equipment${qs ? '?' + qs : ''}`);
    }
    getEquipmentById(id)                { return this.request(`/equipment/${id}`); }
    createEquipment(data)               { return this.request('/equipment', { method: 'POST', body: JSON.stringify(data) }); }
    updateEquipment(id, data)           { return this.request(`/equipment/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
    deleteEquipment(id)                 { return this.request(`/equipment/${id}`, { method: 'DELETE' }); }
    getExpiredVerification(limit, offset) { return this.request(`/equipment/expired-verification?limit=${limit}&offset=${offset}`); }
}

const api = new ApiClient(API_BASE);