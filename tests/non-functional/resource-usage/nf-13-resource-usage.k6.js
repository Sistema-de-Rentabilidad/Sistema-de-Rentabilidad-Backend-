import http from 'k6/http';
import { check, fail, group, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const ACCESS_TOKEN_COOKIE = 'access_token';

const http5xxErrors = new Counter('nf13_http_5xx_errors');
const httpTimeouts = new Counter('nf13_http_timeouts');
const unexpectedStatuses = new Counter('nf13_unexpected_statuses');

const asInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const baseUrl = () => {
  if (!__ENV.API_BASE_URL) {
    fail('API_BASE_URL es requerido. Ejemplo: API_BASE_URL=https://sistema-de-rentabilidad-backend.vercel.app');
  }

  return __ENV.API_BASE_URL.replace(/\/+$/, '');
};

export const options = {
  stages: [
    { duration: __ENV.NF13_WARMUP_DURATION || '1m', target: asInt(__ENV.NF13_WARMUP_VUS, 2) },
    { duration: __ENV.NF13_RAMPUP_DURATION || '2m', target: asInt(__ENV.NF13_TARGET_VUS, 5) },
    { duration: __ENV.NF13_SUSTAINED_DURATION || '5m', target: asInt(__ENV.NF13_TARGET_VUS, 5) },
    { duration: __ENV.NF13_COOLDOWN_DURATION || '1m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000', 'p(99)<4000'],
    nf13_http_5xx_errors: ['count==0'],
    nf13_http_timeouts: ['count==0'],
  },
  userAgent: 'NF-13-resource-usage-k6/1.0',
};

const extractAccessToken = (response) => {
  const cookieEntries = response.cookies && response.cookies[ACCESS_TOKEN_COOKIE];
  const cookie = cookieEntries && cookieEntries[0] && cookieEntries[0].value;

  if (cookie) {
    return cookie;
  }

  const setCookie = response.headers['Set-Cookie'] || response.headers['set-cookie'];
  const match = setCookie && setCookie.match(new RegExp(`${ACCESS_TOKEN_COOKIE}=([^;]+)`));

  return match ? match[1] : undefined;
};

const login = (targetBaseUrl) => {
  if (!__ENV.NF13_EMAIL || !__ENV.NF13_PASSWORD) {
    fail('Configura NF13_ACCESS_TOKEN_COOKIE o NF13_EMAIL/NF13_PASSWORD para ejecutar endpoints autenticados.');
  }

  const response = http.post(
    `${targetBaseUrl}/api/auth/login`,
    JSON.stringify({
      email: __ENV.NF13_EMAIL,
      password: __ENV.NF13_PASSWORD,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'auth_login_setup' },
      timeout: __ENV.NF13_REQUEST_TIMEOUT || '10s',
    }
  );

  const ok = check(response, {
    'login setup devuelve 200': (res) => res.status === 200,
    'login setup entrega cookie access_token': (res) => Boolean(extractAccessToken(res)),
  });

  if (!ok) {
    fail(`No se pudo iniciar sesion para NF-13. Status login: ${response.status}`);
  }

  return extractAccessToken(response);
};

const filterSelectedEndpoints = (endpoints) => {
  const profiles = {
    propietario: 'health,auth_me,proyectos_list,servicios_list,usuarios_list,proyecto_detail,proyecto_horas_resumen,proyecto_fases,proyecto_notas',
    lider: 'health,auth_me,proyectos_list,marcajes_list,proyecto_horas_resumen,proyecto_fases,proyecto_notas',
    empleado: 'health,auth_me,proyectos_list,horas_list',
  };
  const profileEndpoints = profiles[(__ENV.NF13_PROFILE || '').toLowerCase()];
  const endpointSource = __ENV.NF13_ENDPOINTS || profileEndpoints || 'health,auth_me,proyectos_list';
  const selectedNames = endpointSource
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  const selected = endpoints.filter((endpoint) => selectedNames.includes(endpoint.name));

  if (selected.length === 0) {
    fail(`NF13_ENDPOINTS no contiene endpoints validos. Valores disponibles: ${endpoints.map((endpoint) => endpoint.name).join(', ')}`);
  }

  return selected;
};

const buildEndpoints = () => {
  const endpoints = [
    { name: 'health', path: '/health', auth: false, expectedStatuses: [200] },
    { name: 'auth_me', path: '/api/auth/me', auth: true, expectedStatuses: [200] },
    { name: 'proyectos_list', path: '/api/proyectos', auth: true, expectedStatuses: [200] },
    { name: 'servicios_list', path: '/api/servicios', auth: true, expectedStatuses: [200] },
    { name: 'usuarios_list', path: '/api/usuarios', auth: true, expectedStatuses: [200] },
    { name: 'horas_list', path: '/api/horas', auth: true, expectedStatuses: [200] },
    { name: 'marcajes_list', path: '/api/marcajes', auth: true, expectedStatuses: [200] },
  ];

  if (__ENV.NF13_PROJECT_ID) {
    endpoints.push(
      {
        name: 'proyecto_detail',
        path: `/api/proyectos/${encodeURIComponent(__ENV.NF13_PROJECT_ID)}`,
        auth: true,
        expectedStatuses: [200],
      },
      {
        name: 'proyecto_horas_resumen',
        path: `/api/proyectos/${encodeURIComponent(__ENV.NF13_PROJECT_ID)}/horas-resumen`,
        auth: true,
        expectedStatuses: [200],
      },
      {
        name: 'proyecto_fases',
        path: `/api/proyectos/${encodeURIComponent(__ENV.NF13_PROJECT_ID)}/fases`,
        auth: true,
        expectedStatuses: [200],
      },
      {
        name: 'proyecto_notas',
        path: `/api/proyectos/${encodeURIComponent(__ENV.NF13_PROJECT_ID)}/notas`,
        auth: true,
        expectedStatuses: [200],
      }
    );
  }

  if (__ENV.NF13_FASE_ID) {
    endpoints.push({
      name: 'fase_detail',
      path: `/api/fases/${encodeURIComponent(__ENV.NF13_FASE_ID)}`,
      auth: true,
      expectedStatuses: [200],
    });
  }

  if (__ENV.NF13_NOTA_ID) {
    endpoints.push({
      name: 'nota_detail',
      path: `/api/notas/${encodeURIComponent(__ENV.NF13_NOTA_ID)}`,
      auth: true,
      expectedStatuses: [200],
    });
  }

  return filterSelectedEndpoints(endpoints);
};

export function setup() {
  const targetBaseUrl = baseUrl();
  const token = __ENV.NF13_ACCESS_TOKEN_COOKIE || login(targetBaseUrl);

  return {
    baseUrl: targetBaseUrl,
    accessToken: token,
    endpoints: buildEndpoints(),
    requestTimeout: __ENV.NF13_REQUEST_TIMEOUT || '10s',
    sleepSeconds: asInt(__ENV.NF13_SLEEP_SECONDS, 1),
  };
}

const chooseEndpoint = (endpoints) => {
  const index = Math.floor(Math.random() * endpoints.length);
  return endpoints[index];
};

export default function (data) {
  const endpoint = chooseEndpoint(data.endpoints);
  const headers = endpoint.auth
    ? { Cookie: `${ACCESS_TOKEN_COOKIE}=${data.accessToken}` }
    : {};

  group(endpoint.name, () => {
    const response = http.get(`${data.baseUrl}${endpoint.path}`, {
      headers,
      tags: { endpoint: endpoint.name },
      timeout: data.requestTimeout,
    });

    if (response.status >= 500) {
      http5xxErrors.add(1, { endpoint: endpoint.name });
    }

    if (response.error_code === 1050 || (typeof response.error === 'string' && response.error.includes('timeout'))) {
      httpTimeouts.add(1, { endpoint: endpoint.name });
    }

    const expectedStatus = endpoint.expectedStatuses.includes(response.status);
    if (!expectedStatus) {
      unexpectedStatuses.add(1, { endpoint: endpoint.name, status: String(response.status) });
    }

    check(response, {
      [`${endpoint.name} status esperado`]: () => expectedStatus,
      [`${endpoint.name} sin error 5xx`]: (res) => res.status < 500,
    });
  });

  sleep(data.sleepSeconds);
}
