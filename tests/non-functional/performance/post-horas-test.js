import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
    stages: [
        { duration: "1m", target: 20 },
        { duration: "1m", target: 50 },
        { duration: "1m", target: 100 },
        { duration: "30s", target: 100 },
        { duration: "30s", target: 0 },
    ],
    thresholds: {
        checks: ["rate==1"],
        "http_req_failed{endpoint:post_horas}": ["rate==0"],
        "http_req_duration{endpoint:post_horas}": [
            "p(95)<1000",
            "p(99)<2000",
        ],
    },
    setupTimeout: "1m",
};

const BASE_URL =
    __ENV.BASE_URL ||
    "https://sistema-de-rentabilidad-arb9c.ondigitalocean.app/api";

const PASSWORD = __ENV.K6_PASSWORD || "12345678";
const PROJECT_ID = Number(__ENV.PROJECT_ID || 43);
const PHASE_IDS = __ENV.PHASE_IDS
    ? __ENV.PHASE_IDS.split(",").map(Number)
    : [
          140, 141, 142, 143, 144,
          145, 146, 147, 148, 149,
          150, 151, 152, 153, 154,
          155, 156, 157, 158, 159,
      ];
const RUN_ID = (__ENV.RUN_ID || "manual")
    .replace(/[^A-Za-z0-9-]/g, "-")
    .slice(0, 24);

// Evita ejecutar accidentalmente la prueba contra producción.
if (__ENV.ALLOW_PRODUCTION_LOAD !== "YES") {
    throw new Error("Debes indicar ALLOW_PRODUCTION_LOAD=YES");
}

if (!Number.isInteger(PROJECT_ID) || PROJECT_ID < 1) {
    throw new Error("PROJECT_ID debe ser el ID del proyecto de prueba");
}

if (
    PHASE_IDS.length !== 20 ||
    PHASE_IDS.some((id) => !Number.isInteger(id) || id < 1)
) {
    throw new Error("PHASE_IDS debe contener exactamente 20 IDs separados por coma");
}

// Una cuenta líder y cuatro cuentas de empleados de "Empresa Carga 1".
const users = [
    { email: "lider.carga1@test.com", rol: "lider" },
    { email: "empleado.carga1@test.com", rol: "empleado" },
    { email: "empleado.carga14@test.com", rol: "empleado" },
    { email: "empleado.carga27@test.com", rol: "empleado" },
    { email: "empleado.carga40@test.com", rol: "empleado" },
];

// Solo se hacen 5 logins antes de iniciar la carga.
export function setup() {
    const tokens = users.map((user) => {
        const response = http.post(
            `${BASE_URL}/auth/login`,
            JSON.stringify({
                email: user.email,
                password: PASSWORD,
            }),
            {
                headers: { "Content-Type": "application/json" },
                tags: {
                    endpoint: "login",
                    rol: user.rol,
                },
            }
        );

        const loginOk = check(response, {
            "login status 200": (result) => result.status === 200,
        });
        const accessToken = response.cookies.access_token?.[0]?.value;

        if (!loginOk || !accessToken) {
            throw new Error(`No se pudo autenticar ${user.email}`);
        }

        return accessToken;
    });

    return { tokens };
}

export default function (data) {
    // Cada VU registra horas una sola vez.
    if (__ITER > 0) {
        sleep(1);
        return;
    }
    const user = users[(__VU - 1) % users.length];
    const userIndex = (__VU - 1) % users.length;
    const phaseId = PHASE_IDS[Math.floor((__VU - 1) / users.length)];
    const accessToken = data.tokens[userIndex];

    const horasResponse = http.post(
        `${BASE_URL}/horas`,
        JSON.stringify({
            id_proyecto: PROJECT_ID,
            id_fase: phaseId,
            horas: 0.5,
            descripcion: `K6 E3 ${RUN_ID} VU ${__VU}`,
        }),
        {
            headers: {
                "Content-Type": "application/json",
                Cookie: `access_token=${accessToken}`,
            },
            tags: {
                endpoint: "post_horas",
                rol: user.rol,
            },
        }
    );

    check(horasResponse, {
        "registro de horas status 201": (response) => response.status === 201,
    });
}
