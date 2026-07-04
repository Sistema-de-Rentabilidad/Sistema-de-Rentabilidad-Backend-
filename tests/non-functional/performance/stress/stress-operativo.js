import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import { Counter, Rate } from "k6/metrics";

const runtime = JSON.parse(
    open("../../../../tmp/stress-operativo-runtime-meta.json")
);
const runtimeUsers = new SharedArray("stress_operativo_users", () =>
    JSON.parse(open("../../../../tmp/stress-operativo-runtime-users.json"))
);

const DEFAULT_BASE_URL =
    "https://sistema-de-rentabilidad-arb9c.ondigitalocean.app/api";
const BASE_URL = (__ENV.BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
const ORIGIN =
    __ENV.K6_ORIGIN ||
    BASE_URL.replace(/\/api\/?$/, "");
const PASSWORD = __ENV.K6_PASSWORD || "12345678";
const REQUEST_TIMEOUT = __ENV.REQUEST_TIMEOUT || "15s";
const THINK_TIME_SECONDS = Number(__ENV.THINK_TIME_SECONDS || 1);
const MAX_VUS = Number(__ENV.MAX_VUS || 500);
const RUN_ID = (__ENV.RUN_ID || `manual-${Date.now().toString(36)}`)
    .replace(/[^A-Za-z0-9-]/g, "-")
    .slice(0, 32);

const LEVELS = [100, 150, 200, 250, 300, 350, 400, 450, 500];
const OPERATIONS = [
    "login",
    "get_proyectos",
    "post_horas",
    "marcaje_entrada",
    "marcaje_salida",
];

const operationCounters = {
    login: new Counter("stress_login_requests"),
    get_proyectos: new Counter("stress_get_proyectos_requests"),
    post_horas: new Counter("stress_post_horas_requests"),
    marcaje_entrada: new Counter("stress_marcaje_entrada_requests"),
    marcaje_salida: new Counter("stress_marcaje_salida_requests"),
};

const http5xxErrors = new Counter("stress_http_5xx_errors");
const http429Errors = new Counter("stress_http_429_errors");
const httpTimeouts = new Counter("stress_http_timeouts");
const http5xxRate = new Rate("stress_http_5xx_rate");
const http429Rate = new Rate("stress_http_429_rate");
const timeoutRate = new Rate("stress_http_timeout_rate");

const expectedDistribution = (target) => {
    const extraSteps = (target - 100) / 50;

    return {
        login: 8,
        get_proyectos: 52 + (28 * extraSteps),
        post_horas: 25 + (14 * extraSteps),
        marcaje_entrada: 10 + (5 * extraSteps),
        marcaje_salida: 5 + (3 * extraSteps),
    };
};

const failInitialization = (message) => {
    throw new Error(`Stress operativo no habilitado: ${message}`);
};

if (__ENV.ALLOW_PRODUCTION_STRESS !== "YES") {
    failInitialization("debes indicar ALLOW_PRODUCTION_STRESS=YES");
}

if (!LEVELS.includes(MAX_VUS)) {
    failInitialization(
        "MAX_VUS debe ser 100, 150, 200, 250, 300, 350, 400, 450 o 500"
    );
}

if (!Number.isFinite(THINK_TIME_SECONDS) || THINK_TIME_SECONDS < 0.1) {
    failInitialization("THINK_TIME_SECONDS debe ser un numero mayor o igual a 0.1");
}

if (runtime.schemaVersion !== 2) {
    failInitialization("schemaVersion del runtime debe ser 2");
}

if (!ORIGIN || !/^https?:\/\//.test(ORIGIN)) {
    failInitialization(
        "el runtime debe incluir origin o debes indicar K6_ORIGIN"
    );
}

if (
    !runtime.capacity ||
    runtime.capacity.maxSupportedVUs < MAX_VUS ||
    !Array.isArray(runtime.batches) ||
    runtime.userCount < MAX_VUS ||
    runtimeUsers.length < MAX_VUS
) {
    failInitialization(
        `el runtime no tiene capacidad para ${MAX_VUS} VUs; ejecuta check-stress-data.js`
    );
}

const limaDate = new Date(Date.now() - (5 * 60 * 60 * 1000))
    .toISOString()
    .slice(0, 10);
const preparationTime = Date.parse(runtime.preparedAt);
const preparationAge = Date.now() - preparationTime;

if (runtime.businessDate !== limaDate) {
    failInitialization("el runtime debe generarse el mismo dia de la prueba");
}

if (
    !Number.isFinite(preparationTime) ||
    preparationAge < 0 ||
    preparationAge > 60 * 60 * 1000
) {
    failInitialization("el runtime debe tener menos de una hora de antiguedad");
}

const actualDistribution = runtime.batches
    .filter((batch) => batch.target <= MAX_VUS)
    .reduce((counts, batch) => {
        for (const operation of OPERATIONS) {
            counts[operation] += batch.added[operation] || 0;
        }

        return counts;
    }, Object.fromEntries(OPERATIONS.map((operation) => [operation, 0])));

for (const [operation, expected] of Object.entries(
    expectedDistribution(MAX_VUS)
)) {
    if (actualDistribution[operation] !== expected) {
        failInitialization(
            `${operation} requiere ${expected} VUs y tiene ` +
            `${actualDistribution[operation] || 0}`
        );
    }
}

const validateAssignedUser = (user, expectedSlot) => {
    if (!user || user.slot !== expectedSlot) {
        throw new Error(`No existe runtime valido para el VU ${expectedSlot}`);
    }

    if (!OPERATIONS.includes(user.operation)) {
        throw new Error(`Operacion desconocida en el slot ${expectedSlot}`);
    }

    if (!user.cookie || !user.email || !user.id_empresa) {
        throw new Error(`Datos incompletos en el slot ${expectedSlot}`);
    }

    if (user.operation !== "post_horas") {
        return;
    }

    if (
        !Array.isArray(user.hour_assignments) ||
        user.hour_assignments.length === 0
    ) {
        throw new Error(
            `El slot ${expectedSlot} no tiene asignaciones para horas`
        );
    }

    const phaseIds = new Set();

    for (const assignment of user.hour_assignments) {
        if (!assignment.id_proyecto || !assignment.id_fase) {
            throw new Error(
                `El slot ${expectedSlot} tiene una asignacion incompleta`
            );
        }

        if (phaseIds.has(assignment.id_fase)) {
            throw new Error(
                `El slot ${expectedSlot} repite la fase ${assignment.id_fase}`
            );
        }

        phaseIds.add(assignment.id_fase);
    }
};

const stages = [
    { duration: "2m", target: 100 },
    ...LEVELS
        .filter((level) => level > 100 && level <= MAX_VUS)
        .map((target) => ({ duration: "3m", target })),
    { duration: "2m", target: 0 },
];

const abortAfterWarmup = (threshold) => ({
    threshold,
    abortOnFail: true,
    delayAbortEval: "3m",
});

export const options = {
    scenarios: {
        stress_operativo: {
            executor: "ramping-vus",
            startVUs: 0,
            stages,
            gracefulRampDown: "0s",
        },
    },
    discardResponseBodies: true,
    thresholds: {
        checks: [abortAfterWarmup("rate>0.90")],
        http_req_failed: [abortAfterWarmup("rate<0.10")],
        http_req_duration: [abortAfterWarmup("p(95)<10000")],
        stress_http_5xx_rate: [abortAfterWarmup("rate<0.05")],
        stress_http_429_rate: [abortAfterWarmup("rate<0.05")],
        stress_http_timeout_rate: [abortAfterWarmup("rate<0.05")],
        "http_req_duration{endpoint:login}": [
            abortAfterWarmup("p(95)<5000"),
        ],
        "http_req_duration{endpoint:get_proyectos}": [
            abortAfterWarmup("p(95)<5000"),
        ],
        "http_req_duration{endpoint:post_horas}": [
            abortAfterWarmup("p(95)<8000"),
        ],
        "http_req_duration{endpoint:marcaje_entrada}": [
            abortAfterWarmup("p(95)<10000"),
        ],
        "http_req_duration{endpoint:marcaje_salida}": [
            abortAfterWarmup("p(95)<12000"),
        ],
    },
    summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
};

const isTimeout = (response) => (
    response.error_code === 1050 ||
    (
        typeof response.error === "string" &&
        response.error.toLowerCase().includes("timeout")
    )
);

const recordResponse = (endpoint, response) => {
    const serverError = response.status >= 500;
    const rateLimited = response.status === 429;
    const timedOut = isTimeout(response);

    operationCounters[endpoint].add(1);
    http5xxRate.add(serverError);
    http429Rate.add(rateLimited);
    timeoutRate.add(timedOut);

    if (serverError) {
        http5xxErrors.add(1, { endpoint });
    }

    if (rateLimited) {
        http429Errors.add(1, { endpoint });
    }

    if (timedOut) {
        httpTimeouts.add(1, { endpoint });
    }
};

const authenticatedParams = (cookie, endpoint, isWrite = false) => ({
    headers: {
        Cookie: cookie,
        ...(isWrite ? { Origin: ORIGIN } : {}),
    },
    tags: { endpoint },
    timeout: REQUEST_TIMEOUT,
});

const runLogin = (user) => {
    const response = http.post(
        `${BASE_URL}/auth/login`,
        JSON.stringify({
            email: user.email,
            password: PASSWORD,
        }),
        {
            headers: { "Content-Type": "application/json" },
            tags: { endpoint: "login" },
            timeout: REQUEST_TIMEOUT,
        }
    );

    recordResponse("login", response);
    const accessToken = response.cookies.access_token?.[0]?.value;
    check(
        response,
        {
            [`login status 200 (actual ${response.status})`]:
                (result) => result.status === 200,
            "login entrega cookie": () => Boolean(accessToken),
        },
        { endpoint: "login" }
    );

    return accessToken ? `access_token=${accessToken}` : user.cookie;
};

const runGetProjects = (cookie) => {
    const response = http.get(
        `${BASE_URL}/proyectos`,
        authenticatedParams(cookie, "get_proyectos")
    );

    recordResponse("get_proyectos", response);
    check(
        response,
        {
            [`proyectos status 200 (actual ${response.status})`]:
                (result) => result.status === 200,
        },
        { endpoint: "get_proyectos" }
    );
};

const runPostHours = (cookie, assignment, sequence) => {
    const params = authenticatedParams(cookie, "post_horas", true);
    params.headers["Content-Type"] = "application/json";

    const response = http.post(
        `${BASE_URL}/horas`,
        JSON.stringify({
            id_proyecto: assignment.id_proyecto,
            id_fase: assignment.id_fase,
            horas: 0.5,
            descripcion:
                `K6-STRESS-OP ${RUN_ID} VU ${__VU} REG ${sequence}`,
        }),
        params
    );

    recordResponse("post_horas", response);
    check(
        response,
        {
            [`horas status 201 (actual ${response.status})`]:
                (result) => result.status === 201,
        },
        { endpoint: "post_horas" }
    );
};

const runEntry = (cookie) => {
    const response = http.post(
        `${BASE_URL}/marcajes/entrada`,
        null,
        authenticatedParams(cookie, "marcaje_entrada", true)
    );

    recordResponse("marcaje_entrada", response);
    check(
        response,
        {
            [`entrada status 200 (actual ${response.status})`]:
                (result) => result.status === 200,
        },
        { endpoint: "marcaje_entrada" }
    );
};

const runExit = (cookie) => {
    const response = http.post(
        `${BASE_URL}/marcajes/salida`,
        null,
        authenticatedParams(cookie, "marcaje_salida", true)
    );

    recordResponse("marcaje_salida", response);
    check(
        response,
        {
            [`salida status 200 (actual ${response.status})`]:
                (result) => result.status === 200,
        },
        { endpoint: "marcaje_salida" }
    );
};

let primaryOperationCompleted = false;
let activeCookie;
let activeUser;
let nextHourAssignmentIndex = 0;

const runNextHoursAssignment = (user) => {
    const assignment = user.hour_assignments?.[nextHourAssignmentIndex];

    if (!assignment) {
        return false;
    }

    nextHourAssignmentIndex += 1;
    runPostHours(activeCookie, assignment, nextHourAssignmentIndex);
    return true;
};

export default function () {
    if (!activeUser) {
        activeUser = runtimeUsers[__VU - 1];
        validateAssignedUser(activeUser, __VU);
    }

    const user = activeUser;

    if (!activeCookie) {
        activeCookie = user.cookie;
    }

    if (!primaryOperationCompleted) {
        primaryOperationCompleted = true;

        if (user.operation === "login") {
            activeCookie = runLogin(user);
        } else if (user.operation === "get_proyectos") {
            runGetProjects(activeCookie);
        } else if (user.operation === "post_horas") {
            runNextHoursAssignment(user);
        } else if (user.operation === "marcaje_entrada") {
            runEntry(activeCookie);
        } else if (user.operation === "marcaje_salida") {
            runExit(activeCookie);
        }
    } else if (
        user.operation === "post_horas" &&
        runNextHoursAssignment(user)
    ) {
        // Cada asignacion proyecto/fase se consume una sola vez.
    } else {
        runGetProjects(activeCookie);
    }

    sleep(THINK_TIME_SECONDS);
}
