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
const threshold = (expression) => ({
    threshold: expression,
    abortOnFail: true,
    delayAbortEval: "2m30s",
});

if (__ENV.ALLOW_PRODUCTION_STRESS !== "YES") {
    throw new Error("Debes indicar ALLOW_PRODUCTION_STRESS=YES");
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

const scenario = (execName, vus, startTime, maxDuration = "30s") => ({
    executor: "shared-iterations",
    exec: execName,
    vus,
    iterations: vus,
    startTime,
    maxDuration,
    gracefulStop: "0s",
});

export const options = {
    scenarios: {
        salida_base: scenario("salidaBase", 100, "0s"),
        salida_burst: scenario("salidaBurst", 400, "2m", "1m"),
    },
    discardResponseBodies: true,
    thresholds: {
        "checks{endpoint:marcaje_salida}": [threshold("rate>0.98")],
        "http_req_failed{endpoint:marcaje_salida}": [threshold("rate<0.02")],
        "http_req_duration{endpoint:marcaje_salida}": [
            threshold("p(95)<4000"),
            threshold("p(99)<8000"),
        ],
        "http_reqs{endpoint:marcaje_salida}": ["count==500"],
    },
    summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
};

const markExit = (user) => {
    const response = http.post(`${BASE_URL}/marcajes/salida`, null, {
        headers: { Origin: ORIGIN },
        cookies: {
            access_token: {
                value: user.cookie.slice("access_token=".length),
                replace: true,
            },
        },
        tags: { endpoint: "marcaje_salida", run_id: RUN_ID },
        timeout: "15s",
    });

    check(
        response,
        { "salida status 200": (result) => result.status === 200 },
        { endpoint: "marcaje_salida" }
    );
};

export function salidaBase() {
    markExit(users[exec.scenario.iterationInTest]);
}

export function salidaBurst() {
    markExit(users[100 + exec.scenario.iterationInTest]);
    sleep(40);
}
