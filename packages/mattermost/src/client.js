export class MattermostClient {
    constructor({ url, token } = {}) {
        this.baseUrl = (url ?? '').replace(/\/$/, '') + '/api/v4';
        this.token = token ?? null;
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    _headers(extra = {}) {
        const h = { 'Content-Type': 'application/json', ...extra };
        if (this.token) h['Authorization'] = `Bearer ${this.token}`;
        return h;
    }

    async _request(method, path, { body, query, rawResponse = false } = {}) {
        let url = `${this.baseUrl}${path}`;
        if (query) {
            const qs = new URLSearchParams(
                Object.fromEntries(Object.entries(query).filter(([, v]) => v != null)),
            ).toString();
            if (qs) url += `?${qs}`;
        }

        const res = await fetch(url, {
            method,
            headers: this._headers(),
            body: body != null ? JSON.stringify(body) : undefined,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const error = new Error(err.message || `HTTP ${res.status} ${method} ${path}`);
            error.status = res.status;
            error.data = err;
            throw error;
        }

        if (rawResponse) return res;
        const text = await res.text();
        return text ? JSON.parse(text) : null;
    }

    // -------------------------------------------------------------------------
    // Auth
    // -------------------------------------------------------------------------

    /** Authenticate with username/password. Sets this.token from response header. */
    async login(loginId, password) {
        const res = await fetch(`${this.baseUrl}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login_id: loginId, password }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const error = new Error(err.message || `Login failed: HTTP ${res.status}`);
            error.status = res.status;
            error.data = err;
            throw error;
        }

        this.token = res.headers.get('Token');
        return res.json();
    }

    /** Set a pre-existing bot token directly (preferred for bots). */
    loginWithToken(token) {
        this.token = token;
        return this;
    }

    /** Revoke the current session token. */
    async logout() {
        await this._request('POST', '/users/logout');
        this.token = null;
    }

    // -------------------------------------------------------------------------
    // Users
    // -------------------------------------------------------------------------

    /** GET /users/me */
    getMe() {
        return this._request('GET', '/users/me');
    }

    /** GET /users/{user_id} */
    getUser(userId) {
        return this._request('GET', `/users/${userId}`);
    }

    /** GET /users/username/{username} */
    getUserByUsername(username) {
        return this._request('GET', `/users/username/${username}`);
    }

    /** GET /users/email/{email} */
    getUserByEmail(email) {
        return this._request('GET', `/users/email/${encodeURIComponent(email)}`);
    }

    /**
     * POST /users/search
     * @param {string} term - Search term
     * @param {object} [opts] - { team_id, channel_id, not_in_channel_id, limit }
     */
    searchUsers(term, opts = {}) {
        return this._request('POST', '/users/search', { body: { term, ...opts } });
    }

    /**
     * GET /users
     * @param {object} [opts] - { page, per_page, in_team, in_channel, not_in_channel }
     */
    getUsers(opts = {}) {
        return this._request('GET', '/users', { query: opts });
    }

    // -------------------------------------------------------------------------
    // Teams
    // -------------------------------------------------------------------------

    /** GET /teams */
    getTeams({ page = 0, perPage = 60 } = {}) {
        return this._request('GET', '/teams', { query: { page, per_page: perPage } });
    }

    /** GET /teams/{team_id} */
    getTeam(teamId) {
        return this._request('GET', `/teams/${teamId}`);
    }

    /** GET /teams/name/{name} */
    getTeamByName(name) {
        return this._request('GET', `/teams/name/${name}`);
    }

    /** GET /users/me/teams */
    getMyTeams() {
        return this._request('GET', '/users/me/teams');
    }

    /** GET /teams/{team_id}/members/me */
    getMyTeamMember(teamId) {
        return this._request('GET', `/teams/${teamId}/members/me`);
    }

    // -------------------------------------------------------------------------
    // Channels
    // -------------------------------------------------------------------------

    /**
     * POST /channels
     * @param {object} opts - { teamId, name, displayName, type ('O'|'P'), purpose, header }
     */
    createChannel({ teamId, name, displayName, type = 'O', purpose, header } = {}) {
        return this._request('POST', '/channels', {
            body: {
                team_id: teamId,
                name,
                display_name: displayName,
                type,
                purpose,
                header,
            },
        });
    }

    /** GET /channels/{channel_id} */
    getChannel(channelId) {
        return this._request('GET', `/channels/${channelId}`);
    }

    /** GET /teams/{team_id}/channels/name/{channel_name} */
    getChannelByName(teamId, channelName) {
        return this._request('GET', `/teams/${teamId}/channels/name/${channelName}`);
    }

    /**
     * GET /teams/{team_id}/channels
     * @param {object} [opts] - { page, per_page }
     */
    getChannelsForTeam(teamId, { page = 0, perPage = 60 } = {}) {
        return this._request('GET', `/teams/${teamId}/channels`, {
            query: { page, per_page: perPage },
        });
    }

    /** GET /users/me/channels — channels the bot is a member of */
    getMyChannels() {
        return this._request('GET', '/users/me/channels');
    }

    /**
     * POST /channels/direct — open or get existing DM between two users
     * @param {string[]} userIds - exactly two user IDs
     */
    createDirectChannel(userIds) {
        return this._request('POST', '/channels/direct', { body: userIds });
    }

    /**
     * POST /channels/group — open or get existing group message
     * @param {string[]} userIds - 3–7 user IDs
     */
    createGroupChannel(userIds) {
        return this._request('POST', '/channels/group', { body: userIds });
    }

    /**
     * GET /channels/{channel_id}/members
     * @param {object} [opts] - { page, per_page }
     */
    getChannelMembers(channelId, { page = 0, perPage = 60 } = {}) {
        return this._request('GET', `/channels/${channelId}/members`, {
            query: { page, per_page: perPage },
        });
    }

    /** POST /channels/{channel_id}/members */
    addChannelMember(channelId, userId) {
        return this._request('POST', `/channels/${channelId}/members`, {
            body: { user_id: userId },
        });
    }

    /** DELETE /channels/{channel_id}/members/{user_id} */
    removeChannelMember(channelId, userId) {
        return this._request('DELETE', `/channels/${channelId}/members/${userId}`);
    }

    /** DELETE /channels/{channel_id} */
    deleteChannel(channelId) {
        return this._request('DELETE', `/channels/${channelId}`);
    }

    // -------------------------------------------------------------------------
    // Posts
    // -------------------------------------------------------------------------

    /**
     * POST /posts
     * @param {string} channelId
     * @param {string} message
     * @param {object} [opts] - { rootId, props, fileIds, metadata }
     */
    createPost(channelId, message, { rootId, props, fileIds, metadata } = {}) {
        return this._request('POST', '/posts', {
            body: {
                channel_id: channelId,
                message,
                root_id: rootId,
                props,
                file_ids: fileIds,
                metadata,
            },
        });
    }

    /** GET /posts/{post_id} */
    getPost(postId) {
        return this._request('GET', `/posts/${postId}`);
    }

    /**
     * PUT /posts/{post_id}
     * @param {object} [opts] - { props, metadata } — merge with existing post
     */
    updatePost(postId, message, { props, metadata } = {}) {
        return this._request('PUT', `/posts/${postId}`, {
            body: { id: postId, message, props, metadata },
        });
    }

    /** DELETE /posts/{post_id} */
    deletePost(postId) {
        return this._request('DELETE', `/posts/${postId}`);
    }

    /** POST /posts/{post_id}/pin */
    pinPost(postId) {
        return this._request('POST', `/posts/${postId}/pin`);
    }

    /** POST /posts/{post_id}/unpin */
    unpinPost(postId) {
        return this._request('POST', `/posts/${postId}/unpin`);
    }

    /**
     * GET /channels/{channel_id}/posts
     * @param {object} [opts] - { page, per_page, since, before, after }
     */
    getPostsForChannel(channelId, opts = {}) {
        const { page = 0, perPage = 60, since, before, after } = opts;
        return this._request('GET', `/channels/${channelId}/posts`, {
            query: { page, per_page: perPage, since, before, after },
        });
    }

    /**
     * POST /teams/{team_id}/posts/search
     * @param {string} teamId
     * @param {string} terms - Search terms
     * @param {boolean} [isOrSearch] - OR vs AND search
     */
    searchPosts(teamId, terms, isOrSearch = false) {
        return this._request('POST', `/teams/${teamId}/posts/search`, {
            body: { terms, is_or_search: isOrSearch },
        });
    }

    // -------------------------------------------------------------------------
    // Reactions (emoji)
    // -------------------------------------------------------------------------

    /**
     * POST /reactions
     * @param {string} userId
     * @param {string} postId
     * @param {string} emojiName - e.g. "thumbsup"
     */
    addReaction(userId, postId, emojiName) {
        return this._request('POST', '/reactions', {
            body: {
                user_id: userId,
                post_id: postId,
                emoji_name: emojiName,
            },
        });
    }

    /** DELETE /users/{user_id}/posts/{post_id}/reactions/{emoji_name} */
    removeReaction(userId, postId, emojiName) {
        return this._request('DELETE', `/users/${userId}/posts/${postId}/reactions/${emojiName}`);
    }

    /** GET /posts/{post_id}/reactions */
    getReactions(postId) {
        return this._request('GET', `/posts/${postId}/reactions`);
    }

    // -------------------------------------------------------------------------
    // Files
    // -------------------------------------------------------------------------

    /**
     * POST /files — upload a file attachment
     * @param {string} channelId
     * @param {string} filename - file name with extension
     * @param {Buffer|Uint8Array} buffer - file content
     * @param {string} [mimeType] - e.g. "image/png"
     * @returns {{ file_infos: object[], client_ids: string[] }}
     */
    async uploadFile(channelId, filename, buffer, mimeType = 'application/octet-stream') {
        const form = new FormData();
        form.append('channel_id', channelId);
        form.append('files', new Blob([buffer], { type: mimeType }), filename);

        const headers = {};
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

        const res = await fetch(`${this.baseUrl}/files`, {
            method: 'POST',
            headers,
            body: form,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const error = new Error(err.message || `Upload failed: HTTP ${res.status}`);
            error.status = res.status;
            error.data = err;
            throw error;
        }

        return res.json();
    }

    // -------------------------------------------------------------------------
    // Webhooks
    // -------------------------------------------------------------------------

    /** GET /hooks/incoming — list all incoming webhooks */
    getIncomingWebhooks({ page = 0, perPage = 60 } = {}) {
        return this._request('GET', '/hooks/incoming', {
            query: { page, per_page: perPage },
        });
    }

    /**
     * POST /hooks/incoming — create an incoming webhook
     * @param {object} opts - { channelId, displayName, description, username, iconUrl }
     */
    createIncomingWebhook({ channelId, displayName, description, username, iconUrl } = {}) {
        return this._request('POST', '/hooks/incoming', {
            body: {
                channel_id: channelId,
                display_name: displayName,
                description,
                username,
                icon_url: iconUrl,
            },
        });
    }

    // -------------------------------------------------------------------------
    // Utility
    // -------------------------------------------------------------------------

    /** GET /system/ping — health check */
    ping() {
        return this._request('GET', '/system/ping');
    }
}
