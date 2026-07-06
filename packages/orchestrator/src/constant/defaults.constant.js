export const READ_VERBS = [
    'get',
    'list',
    'search',
    'find',
    'fetch',
    'read',
    'view',
    'query',
    'retrieve',
    'describe',
    'show',
    'count',
    'stat',
    'stats',
    'info',
    'ping',
    'whoami',
    'preview',
    'check',
    'download',
    'peek',
    'inspect',
    'aggregate',
    'explain',
    'schema',
    'indexes',
    'storage',
    'overview',
    'health',
    'extensions',
];

export const ADMIN_VERBS = [
    'delete',
    'purge',
    'drop',
    'flush',
    'truncate',
    'destroy',
    'remove',
    'reset',
    'clear',
];

export const READ_ONLY_REGEX = `\\b(${READ_VERBS.join('|')})\\b`;

export const NAMESPACE_SEP = '__';

function rabbitEnv(conn) {
    const u = new URL(conn);
    const https = u.protocol === 'https:';
    return {
        RABBITMQ_PROTOCOL: https ? 'https' : 'http',
        RABBITMQ_HOST: u.hostname,
        RABBITMQ_MANAGEMENT_PORT: u.port || (https ? '15671' : '15672'),
        RABBITMQ_USERNAME: decodeURIComponent(u.username),
        RABBITMQ_PASSWORD: decodeURIComponent(u.password),
        ...(u.pathname && u.pathname !== '/' ? { RABBITMQ_BASE_PATH: u.pathname } : {}),
    };
}

export const KIND_TEMPLATES = {
    mongo: {
        command: 'mongodb-mcp-server',
        args: ['--readOnly'],
        buildEnv: (conn) => ({ MDB_MCP_CONNECTION_STRING: conn }),
    },
    rabbit: {
        command: 'rabbitmq-mcp',
        args: [],
        buildEnv: rabbitEnv,
    },
    redis: {
        command: 'redis-mcp',
        args: [],
        buildEnv: (conn) => ({ REDIS_URL: conn }),
    },
};

export const TOOL_ALLOW = {
    mongo: [
        'find',
        'count',
        'aggregate',
        'list-databases',
        'list-collections',
        'collection-schema',
        'collection-indexes',
        'collection-storage-size',
        'db-stats',
        'explain',
    ],
    rabbit: [
        'list-queues',
        'list-queues-vhost',
        'get-queue',
        'get-queue-messages',
        'get-queue-unacked',
        'get-queue-bindings',
        'list-exchanges',
        'get-exchange',
        'list-bindings',
        'list-connections',
        'list-consumers',
        'list-channels',
        'list-nodes',
        'get-node-memory',
        'get-health-alarms',
        'list-vhosts',
    ],
};
