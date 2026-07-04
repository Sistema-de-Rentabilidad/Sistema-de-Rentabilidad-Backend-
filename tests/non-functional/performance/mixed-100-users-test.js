import http from "k6/http";
import { check, sleep } from "k6";

const runtime = JSON.parse(
    open("../../../tmp/mixed-100-users-data.json")
);

const BASE_URL =
    __ENV.BASE_URL ||
    "https://sistema-de-rentabilidad-arb9c.ondigitalocean.app/api";
const PASSWORD = __ENV.K6_PASSWORD || "12345678";
const ORIGIN =
    __ENV.K6_ORIGIN ||
    BASE_URL.replace(/\/api\/?$/, "");
const RUN_ID = (__ENV.RUN_ID || "manual")
    .replace(/[^A-Za-z0-9-]/g, "-")
    .slice(0, 24);

const EXPECTED_DISTRIBUTION = {
    login: 8,
    get_proyectos: 52,
    post_horas: 25,
    entrada: 10,
    salida: 5,
};

if (__ENV.ALLOW_PRODUCTION_LOAD !== "YES") {
    throw new Error("Debes indicar ALLOW_PRODUCTION_LOAD=YES");
}

if (!Array.isArray(runtime.users) || runtime.users.length !== 100) {
    throw new Error("El archivo preparado debe contener exactamente 100 usuarios");
}

for (const [operation, expected] of Object.entries(EXPECTED_DISTRIBUTION)) {
    const actual = runtime.users.filter(
        (user) => user.operation === operation
    ).length;

    if (actual !== expected) {
        throw new Error(
            `${operation} debe tener ${expected} usuarios y tiene ${actual}`
        );
    }
}

const limaDate = new Date(Date.now() - 5 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
const preparationAge = Date.now() - Date.parse(runtime.preparedAt);

if (runtime.businessDate !== limaDate) {
    throw new Error("Los datos deben prepararse el mismo dia de la prueba");
}

if (preparationAge < 0 || preparationAge > 60 * 60 * 1000) {
    throw new Error("Los datos preparados tienen mas de una hora");
}

export const options = {
    scenarios: {
        mixed_100_users: {
            executor: "per-vu-iterations",
            vus: 100,
            iterations: 1,
            maxDuration: "16m",
        },
    },
    thresholds: {
        checks: ["rate==1"],
        http_req_failed: ["rate==0"],
        http_req_duration: ["p(95)<2000"],
    },
    discardResponseBodies: true,
};

const requestParams = (user, includeOrigin = false) => ({
    headers: {
        Cookie: user.cookie,
        ...(includeOrigin ? { Origin: ORIGIN } : {}),
    },
    tags: {
        endpoint: user.operation,
        rol: user.rol,
    },
});

const runLogin = (user) => {
    const response = http.post(
        `${BASE_URL}/auth/login`,
        JSON.stringify({
            email: user.email,
            password: PASSWORD,
        }),
        {
            headers: {
                "Content-Type": "application/json",
            },
            tags: {
                endpoint: user.operation,
                rol: user.rol,
            },
        }
    );

    check(response, {
        "login status 200": (result) => result.status === 200,
        "login entrega cookie": (result) =>
            Boolean(result.cookies.access_token?.[0]?.value),
    });
};

const runGetProjects = (user) => {
    const response = http.get(
        `${BASE_URL}/proyectos`,
        requestParams(user)
    );

    check(response, {
        "proyectos status 200": (result) => result.status === 200,
    });
};

const runPostHours = (user) => {
    const response = http.post(
        `${BASE_URL}/horas`,
        JSON.stringify({
            id_proyecto: user.id_proyecto,
            id_fase: user.id_fase,
            horas: 0.5,
            descripcion: `K6 mixta ${RUN_ID} VU ${__VU}`,
        }),
        {
            ...requestParams(user, true),
            headers: {
                ...requestParams(user, true).headers,
                "Content-Type": "application/json",
            },
        }
    );

    check(response, {
        "horas status 201": (result) => result.status === 201,
    });
};

const runEntry = (user) => {
    const response = http.post(
        `${BASE_URL}/marcajes/entrada`,
        null,
        requestParams(user, true)
    );

    check(response, {
        "entrada status 200": (result) => result.status === 200,
    });
};

const runExit = (user) => {
    const response = http.post(
        `${BASE_URL}/marcajes/salida`,
        null,
        requestParams(user, true)
    );

    check(response, {
        "salida status 200": (result) => result.status === 200,
    });
};

const operations = {
    login: runLogin,
    get_proyectos: runGetProjects,
    post_horas: runPostHours,
    entrada: runEntry,
    salida: runExit,
};

export default function () {
    const user = runtime.users[__VU - 1];
    const delaySeconds = ((__VU - 1) % 10) * 100;

    sleep(delaySeconds);
    operations[user.operation](user);
    sleep(900 - delaySeconds);
}
