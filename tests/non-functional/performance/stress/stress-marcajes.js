import http from "k6/http";
import { check, sleep } from "k6";
import exec from "k6/execution";
import { SharedArray } from "k6/data";

const runtime = JSON.parse(
    open("../../../../tmp/stress-marcajes-runtime-meta.json")
);
const users = new SharedArray("stress_marcajes_users", () =>
    JSON.parse(open("../../../../tmp/stress-marcajes-runtime-users.json"))
);

const BASE_URL = (
    __ENV.BASE_URL ||
    "https://sistema-de-rentabilidad-arb9c.ondigitalocean.app/api"
).replace(/\/+$/, "");
const ORIGIN = __ENV.K6_ORIGIN || BASE_URL.replace(/\/api\/?$/, "");
const RUN_ID = __ENV.RUN_ID || "";

const threshold = (expression, delay) => ({
    threshold: expression,
    abortOnFail: true,
    delayAbortEval: delay,
});

if (__ENV.ALLOW_PRODUCTION_STRESS !== "YES") {
    throw new Error("Debes indicar ALLOW_PRODUCTION_STRESS=YES");
}

const preparedAt = Date.parse(runtime.preparedAt);
const limaDate = new Date(Date.now() - (5 * 60 * 60 * 1000))
    .toISOString()
    .slice(0, 10);

if (
    runtime.schemaVersion !== 1 ||
    runtime.runId !== RUN_ID ||
    runtime.businessDate !== limaDate ||
    runtime.userCount !== 500 ||
    users.length !== 500 ||
    !Number.isFinite(preparedAt) ||
    Date.now() - preparedAt > 60 * 60 * 1000
) {
    throw new Error("Runtime invalido o vencido; ejecuta el preparador");
}

const scenario = (execName, vus, startTime) => ({
    executor: "shared-iterations",
    exec: execName,
    vus,
    iterations: vus,
    startTime,
    maxDuration: "30s",
    gracefulStop: "0s",
});

export const options = {
    scenarios: {
        entrada_base: scenario("entradaBase", 100, "0s"),
        entrada_burst: scenario("entradaBurst", 400, "2m"),
        salida_base: scenario("salidaBase", 100, "5m"),
        salida_burst: {
            ...scenario("salidaBurst", 400, "7m"),
            maxDuration: "1m",
        },
    },
    discardResponseBodies: true,
    thresholds: {
        "checks{endpoint:marcaje_entrada}": [
            threshold("rate>0.98", "3m"),
        ],
        "http_req_failed{endpoint:marcaje_entrada}": [
            threshold("rate<0.02", "3m"),
        ],
        "http_req_duration{endpoint:marcaje_entrada}": [
            threshold("p(95)<3000", "3m"),
            threshold("p(99)<6000", "3m"),
        ],
        "checks{endpoint:marcaje_salida}": [
            threshold("rate>0.98", "7m30s"),
        ],
        "http_req_failed{endpoint:marcaje_salida}": [
            threshold("rate<0.02", "7m30s"),
        ],
        "http_req_duration{endpoint:marcaje_salida}": [
            threshold("p(95)<4000", "7m30s"),
            threshold("p(99)<8000", "7m30s"),
        ],
        "http_reqs{endpoint:marcaje_entrada}": ["count==500"],
        "http_reqs{endpoint:marcaje_salida}": ["count==500"],
    },
    summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
};

const mark = (operation, user) => {
    const endpoint = `marcaje_${operation}`;
    const response = http.post(
        `${BASE_URL}/marcajes/${operation}`,
        null,
        {
            headers: {
                Origin: ORIGIN,
            },
            cookies: {
                access_token: {
                    value: user.cookie.slice("access_token=".length),
                    replace: true,
                },
            },
            tags: { endpoint, run_id: RUN_ID },
            timeout: "15s",
        }
    );

    check(
        response,
        { [`${operation} status 200`]: (result) => result.status === 200 },
        { endpoint }
    );
};

const selectedUser = (offset) =>
    users[offset + exec.scenario.iterationInTest];

export function entradaBase() {
    mark("entrada", selectedUser(0));
}

export function entradaBurst() {
    mark("entrada", selectedUser(100));
}

export function salidaBase() {
    mark("salida", selectedUser(0));
}

export function salidaBurst() {
    mark("salida", selectedUser(100));
    sleep(40);
}
