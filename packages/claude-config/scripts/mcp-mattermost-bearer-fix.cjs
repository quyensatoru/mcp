const realFetch = globalThis.fetch;
globalThis.fetch = (url, init) => {
    const auth = init?.headers?.Authorization;
    if (typeof auth === 'string' && auth.startsWith('BEARER ')) {
        init.headers.Authorization = `Bearer ${auth.slice(7)}`;
    }
    return realFetch(url, init);
};
