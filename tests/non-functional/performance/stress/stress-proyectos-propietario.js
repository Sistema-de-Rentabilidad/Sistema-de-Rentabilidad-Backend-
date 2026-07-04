import http from "k6/http";
import { check, sleep } from "k6";
import exec from "k6/execution";
import { Counter } from "k6/metrics";

const runtime = JSON.parse(
    open("../../../../tmp/owner-projects-write-stress-runtime.json")
);

const BASE_URL = (
    __ENV.BASE_URL ||
    "https://sistema-de-rentabilidad-arb9c.ondigitalocean.app/api"
).replace(/\/+$/, "");
const ORIGIN = __ENV.K6_ORIGIN || BASE_URL.replace(/\/api\/?$/, "");
const PASSWORD = __ENV.K6_PASSWORD || "12345678";
const RUN_ID = __ENV.RUN_ID || "";
const MAX_PROJECTS = 20000;

const projectsCreated = new Counter("owner_projects_created");
const projectReads = new Counter("owner_project_reads");

const abortThreshold = (threshold) => ({
    threshold,
    abortOnFail: true,
    delayAbortEval: "3m",
});

const stop = (message, response) => {
    const detail = response
        ? ` | status=${response.status} | ${response.timings?.duration || 0}ms`
        : "";
    console.error(`PARADA AUTOMATICA | ${message}${detail}`);
    exec.test.abort(message);
};

if (__ENV.ALLOW_PRODUCTION_STRESS !== "YES") {
    throw new Error("Debes indicar ALLOW_PRODUCTION_STRESS=YES");
}

if (!/^[A-Za-z0-9-]{3,32}$/.test(RUN_ID) || runtime.runId !== RUN_ID) {
    throw new Error("RUN_ID invalido o distinto al runtime");
}

const preparedAt = Date.parse(runtime.preparedAt);
const age = Date.now() - preparedAt;
const limaDate = new Date(Date.now() - (5 * 60 * 60 * 1000))
    .toISOString()
    .slice(0, 10);

if (
    runtime.schemaVersion !== 1 ||
    runtime.businessDate !== limaDate ||
    !Number.isFinite(preparedAt) ||
    age < 0 ||
    age > 60 * 60 * 1000 ||
    runtime.maxProjects !== MAX_PROJECTS ||
    runtime.owners?.length !== 5
) {
    throw new Error("Runtime invalido, vencido o incompleto; ejecuta el preflight");
}

export const options = {
    scenarios: {
        owner_projects_write_stress: {
            executor: "ramping-vus",
            startVUs: 5,
            stages: [
                { duration: "1m", target: 30 },
                { duration: "1m", target: 60 },
                { duration: "1m", target: 80 },
                { duration: "1m", target: 80 },
                { duration: "1m", target: 100 },
                { duration: "1m", target: 100 },
                { duration: "1m", target: 120 },
                { duration: "1m", target: 120 },
                { duration: "1m", target: 150 },
                { duration: "1m", target: 150 },
                { duration: "1m", target: 175 },
                { duration: "1m", target: 175 },
                { duration: "1m", target: 200 },
                { duration: "1m", target: 200 },
                { duration: "1m", target: 0 },
            ],
            gracefulRampDown: "0s",
            gracefulStop: "0s",
        },
    },
    setupTimeout: "1m",
    discardResponseBodies: true,
    thresholds: {
        checks: [abortThreshold("rate>0.98")],
        http_req_failed: [abortThreshold("rate<0.02")],
        "http_req_duration{endpoint:post_proyectos}": [
            abortThreshold("p(95)<2500"),
            abortThreshold("p(99)<5000"),
        ],
        "http_req_duration{endpoint:get_proyectos}": [
            abortThreshold("p(95)<1500"),
            abortThreshold("p(99)<3000"),
        ],
    },
    summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
};

const params = (cookie, endpoint, isPost = false) => ({
    headers: {
        Cookie: cookie,
        ...(isPost ? {
            Origin: ORIGIN,
            "Content-Type": "application/json",
        } : {}),
    },
    tags: { endpoint, rol: "propietario" },
    timeout: "8s",
    ...(isPost ? { responseType: "text" } : {}),
});

export function setup() {
    const sessions = runtime.owners.map((owner) => {
        const response = http.post(
            `${BASE_URL}/auth/login`,
            JSON.stringify({ email: owner.email, password: PASSWORD }),
            {
                headers: { "Content-Type": "application/json" },
                timeout: "8s",
                responseType: "text",
                tags: { endpoint: "login", rol: "propietario" },
            }
        );
        const token = response.cookies.access_token?.[0]?.value;

        if (response.status !== 200 || !token) {
            stop(`No se pudo autenticar ${owner.email}`, response);
        }

        return { ...owner, cookie: `access_token=${token}` };
    });

    console.log(`Stress preparado | RUN_ID=${RUN_ID} | 5 propietarios`);
    return { sessions };
}

const createProject = (session, number) => {
    const iteration = exec.scenario.iterationInTest;

    if ((iteration * 2) + number > MAX_PROJECTS) {
        stop(`Limite de ${MAX_PROJECTS} proyectos alcanzado`);
    }

    const response = http.post(
        `${BASE_URL}/proyectos`,
        JSON.stringify({
            nombre:
                `K6_OWNER_STRESS_${RUN_ID}_VU${exec.vu.idInTest}_` +
                `I${iteration}_P${number}`,
            presupuesto: 10000,
            margen: 20,
            id_servicio: session.id_servicio,
        }),
        params(session.cookie, "post_proyectos", true)
    );

    let body;
    try {
        body = response.json();
    } catch {
        body = null;
    }

    const valid =
        response.status === 201 &&
        body?.success === true &&
        Boolean(body?.data?.id_proyecto);

    check(response, {
        "POST proyecto valido": () => valid,
    }, { endpoint: "post_proyectos" });

    if (valid) projectsCreated.add(1);
};

const readProjects = (session) => {
    const response = http.get(
        `${BASE_URL}/proyectos`,
        params(session.cookie, "get_proyectos")
    );
    const valid = response.status === 200;

    check(response, {
        "GET proyectos valido": () => valid,
    }, { endpoint: "get_proyectos" });

    if (valid) projectReads.add(1);
};

export default function (data) {
    const session = data.sessions[(exec.vu.idInTest - 1) % 5];

    createProject(session, 1);
    sleep(1);
    createProject(session, 2);
    sleep(1);
    readProjects(session);
    sleep(4);
}

export function teardown() {
    console.log(`Stress finalizado | RUN_ID=${RUN_ID} | datos conservados`);
}

export function handleSummary(data) {
    delete data.setup_data;
    return {
        "tmp/owner-projects-write-stress-summary.json":
            JSON.stringify(data, null, 2),
    };
}
