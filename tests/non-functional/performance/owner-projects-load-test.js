import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";

const runtime = JSON.parse(
    open("../../../tmp/owner-projects-load-data.json")
);

const BASE_URL =
    __ENV.BASE_URL ||
    "https://sistema-de-rentabilidad-arb9c.ondigitalocean.app/api";
const ORIGIN = __ENV.K6_ORIGIN || BASE_URL.replace(/\/api\/?$/, "");
const PASSWORD = __ENV.K6_PASSWORD || "12345678";
const TIMEOUT = __ENV.REQUEST_TIMEOUT || "5s";

const logins = new Counter("owner_logins");
const projectReads = new Counter("owner_project_reads");
const projectsCreated = new Counter("owner_projects_created");

if (runtime.owners?.length !== 5) {
    throw new Error("Ejecuta primero prepare-owner-projects-load.js");
}

export const options = {
    scenarios: {
        owner_projects: {
            executor: "ramping-vus",
            startVUs: 0,
            stages: [
                { duration: "30s", target: 1 },
                { duration: "45s", target: 3 },
                { duration: "45s", target: 5 },
                { duration: "3m", target: 5 },
                { duration: "1m", target: 0 },
            ],
            gracefulRampDown: "0s",
        },
    },
    setupTimeout: "1m",
    discardResponseBodies: true,
    thresholds: {
        checks: ["rate==1"],
        http_req_failed: ["rate==0"],
        "http_req_duration{endpoint:login}": ["p(95)<2000"],
        "http_req_duration{endpoint:get_proyectos}": ["p(95)<1500"],
        "http_req_duration{endpoint:post_proyectos}": ["p(95)<2500"],
        owner_logins: ["count==5"],
        owner_project_reads: ["count<=90"],
        owner_projects_created: ["count<=180"],
    },
};

const requestOptions = (session, endpoint, isPost = false) => ({
    headers: {
        Cookie: session.cookie,
        ...(isPost ? {
            Origin: ORIGIN,
            "Content-Type": "application/json",
        } : {}),
    },
    tags: {
        endpoint,
        rol: "propietario",
    },
    timeout: TIMEOUT,
});

export function setup() {
    const baseRunId = (__ENV.RUN_ID || "owner-load")
        .replace(/[^A-Za-z0-9-]/g, "-")
        .slice(0, 24);
    const runId = `${baseRunId}-${Date.now().toString(36)}`;

    const sessions = runtime.owners.map((owner) => {
        logins.add(1);

        const response = http.post(
            `${BASE_URL}/auth/login`,
            JSON.stringify({
                email: owner.email,
                password: PASSWORD,
            }),
            {
                headers: { "Content-Type": "application/json" },
                tags: { endpoint: "login", rol: "propietario" },
                timeout: TIMEOUT,
            }
        );
        const token = response.cookies.access_token?.[0]?.value;
        const loginOk = check(response, {
            "login status 200": (result) => result.status === 200,
            "login entrega cookie": () => Boolean(token),
        });

        if (!loginOk || !token) {
            throw new Error(`No se pudo autenticar ${owner.email}`);
        }

        return {
            ...owner,
            cookie: `access_token=${token}`,
        };
    });

    console.log(`RUN_ID efectivo: ${runId}`);
    return { runId, sessions };
}

const createProject = (session, runId, number) => {
    const response = http.post(
        `${BASE_URL}/proyectos`,
        JSON.stringify({
            nombre:
                `K6_OWNER_LOAD_${runId}_VU${__VU}_I${__ITER}_P${number}`,
            presupuesto: 10000,
            margen: 20,
            id_servicio: session.id_servicio,
        }),
        requestOptions(session, "post_proyectos", true)
    );

    if (response.status === 201) {
        projectsCreated.add(1);
    }

    check(response, {
        "proyecto status 201": (result) => result.status === 201,
    });
};

export default function (data) {
    const session = data.sessions[(__VU - 1) % 5];

    projectReads.add(1);
    const projectsResponse = http.get(
        `${BASE_URL}/proyectos`,
        requestOptions(session, "get_proyectos")
    );
    check(projectsResponse, {
        "proyectos status 200": (result) => result.status === 200,
    });

    sleep(1);
    createProject(session, data.runId, 1);
    sleep(1);
    createProject(session, data.runId, 2);
    sleep(18);
}
