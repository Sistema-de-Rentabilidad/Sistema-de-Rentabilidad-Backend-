import http from "k6/http";
import { check, sleep } from "k6";
import exec from "k6/execution";
import { SharedArray } from "k6/data";

const runtime = JSON.parse(
    open("../../../../tmp/stress-marcajes-salida-runtime-meta.json")
);
const users = new SharedArray("stress_marcajes_salida_users", () =>
    JSON.parse(open("../../../../tmp/stress-marcajes-salida-runtime-users.json"))
);
const BASE_URL = (
    __ENV.BASE_URL ||
    "https://sistema-de-rentabilidad-arb9c.ondigitalocean.app/api"
).replace(/\/+$/, "");
const ORIGIN = __ENV.K6_ORIGIN || BASE_URL.replace(/\/api\/?$/, "");
const RUN_ID = __ENV.RUN_ID || "";
const BURST_WINDOW_SECONDS = Number(__ENV.BURST_WINDOW_SECONDS || 0);

if (__ENV.ALLOW_PRODUCTION_STRESS !== "YES") {
    throw new Error("Debes indicar ALLOW_PRODUCTION_STRESS=YES");
}

if (!Number.isFinite(BURST_WINDOW_SECONDS) || BURST_WINDOW_SECONDS < 0) {
    throw new Error("BURST_WINDOW_SECONDS debe ser un numero mayor o igual a 0");
}

const preparedAt = Date.parse(runtime.preparedAt);
const limaDate = new Date(Date.now() - 5 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

if (
    runtime.schemaVersion !== 1 ||
    runtime.operation !== "salida" ||
    runtime.runId !== RUN_ID ||
    runtime.businessDate !== limaDate ||
    runtime.userCount !== 500 ||
    users.length !== 500 ||
    !Number.isFinite(preparedAt) ||
    Date.now() - preparedAt > 60 * 60 * 1000
) {
    throw new Error("Runtime invalido o vencido; ejecuta el preparador de salida");
}

const scenario = (execName, vus, iterations, startTime, maxDuration) => ({
    executor: "shared-iterations",
    exec: execName,
    vus,
    iterations,
    startTime,
    maxDuration,
    gracefulStop: "30s",
});

export const options = {
    scenarios: {
        salida_base: scenario("salidaBase", 100, 100, "0s", "1m"),
        salida_burst: scenario("salidaBurst", 400, 400, "2m", "2m"),
    },
    discardResponseBodies: true,
    thresholds: {
        "checks{endpoint:marcaje_salida}": ["rate>0.98"],
        "http_req_failed{endpoint:marcaje_salida}": ["rate<0.02"],
        "http_req_duration{endpoint:marcaje_salida,fase:base}": [
            "p(95)<4000",
        ],
        "http_req_duration{endpoint:marcaje_salida,fase:burst}": [
            "p(95)<8000",
            "p(99)<12000",
        ],
        "http_req_duration{endpoint:marcaje_salida}": [
            "p(95)<8000",
            "p(99)<12000",
        ],
        "http_reqs{endpoint:marcaje_salida}": ["count==500"],
        "http_reqs{endpoint:marcaje_salida,fase:base}": ["count==100"],
        "http_reqs{endpoint:marcaje_salida,fase:burst}": ["count==400"],
    },
    summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
};

const markExit = (user, fase) => {
    const response = http.post(`${BASE_URL}/marcajes/salida`, null, {
        headers: { Origin: ORIGIN },
        cookies: {
            access_token: {
                value: user.cookie.slice("access_token=".length),
                replace: true,
            },
        },
        tags: { endpoint: "marcaje_salida", fase, run_id: RUN_ID },
        timeout: "15s",
    });

    check(
        response,
        { "salida status 200": (result) => result.status === 200 },
        { endpoint: "marcaje_salida", fase, run_id: RUN_ID }
    );
};

export function salidaBase() {
    markExit(users[exec.scenario.iterationInTest], "base");
}

export function salidaBurst() {
    if (BURST_WINDOW_SECONDS > 0) {
        sleep(Math.random() * BURST_WINDOW_SECONDS);
    }

    markExit(users[100 + exec.scenario.iterationInTest], "burst");
}
