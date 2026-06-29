import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
    stages: [
        { duration: "1s", target: 10 },
        { duration: "2s", target: 20 },
        { duration: "2s", target: 30 },
        { duration: "1s", target: 0 },
    ],
    thresholds: {
        "http_req_duration{endpoint:post_proyectos}": [
            "p(95)<=500",
            "avg<=300",
        ],
        "http_req_failed{endpoint:post_proyectos}": ["rate<=0.01"],
        "checks{endpoint:post_proyectos}": ["rate>=0.99"],
        "http_reqs{endpoint:post_proyectos}": ["count==30"],
    },
    setupTimeout: "30s",
};

const BASE_URL =
    __ENV.BASE_URL ||
    "https://sistema-de-rentabilidad-arb9c.ondigitalocean.app/api";
const EMAIL =
    __ENV.K6_EMAIL || "propietario.carga1@test.com";
const PASSWORD = __ENV.K6_PASSWORD || "12345678";
const SERVICE_ID = Number(__ENV.SERVICE_ID || 17);
const REQUEST_TIMEOUT = __ENV.REQUEST_TIMEOUT || "5s";

if (__ENV.ALLOW_PRODUCTION_LOAD !== "YES") {
    throw new Error("Debes indicar ALLOW_PRODUCTION_LOAD=YES");
}

export function setup() {
    let token = __ENV.K6_ACCESS_TOKEN;

    if (!token) {
        const response = http.post(
            `${BASE_URL}/auth/login`,
            JSON.stringify({ email: EMAIL, password: PASSWORD }),
            {
                headers: { "Content-Type": "application/json" },
                timeout: REQUEST_TIMEOUT,
            }
        );

        token = response.cookies.access_token?.[0]?.value;

        if (response.status !== 200 || !token) {
            throw new Error(`No se pudo autenticar ${EMAIL}`);
        }
    }

    const runId = (__ENV.RUN_ID || Date.now().toString(36))
        .replace(/[^A-Za-z0-9-]/g, "-")
        .slice(0, 24);

    return { token, runId };
}

export default function (data) {
    // Cada VU crea un solo proyecto.
    if (__ITER > 0) {
        sleep(1);
        return;
    }

    const nombre = `K6 Proyecto ${data.runId} VU ${__VU}`;
    const response = http.post(
        `${BASE_URL}/proyectos`,
        JSON.stringify({
            nombre,
            presupuesto: 10000,
            margen: 20,
            id_servicio: SERVICE_ID,
        }),
        {
            headers: {
                "Content-Type": "application/json",
                Cookie: `access_token=${data.token}`,
            },
            tags: {
                endpoint: "post_proyectos",
                rol: "propietario",
            },
            timeout: REQUEST_TIMEOUT,
        }
    );

    let body = null;
    try {
        body = response.json();
    } catch {
        // El check reportará una respuesta inválida.
    }

    check(
        response,
        {
            "proyecto status 201": (result) => result.status === 201,
            "proyecto creado correctamente": () =>
                body?.success === true && Boolean(body?.data?.id_proyecto),
        },
        { endpoint: "post_proyectos" }
    );
}
