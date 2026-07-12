import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL =
    "https://sistema-de-rentabilidad-arb9c.ondigitalocean.app/api";

export const options = {
    scenarios: {
        stress_test: {
            executor: "ramping-vus",
            startVUs: 0,
            stages: [
                { duration: "5m", target: 100 },
                { duration: "5m", target: 200 },
                { duration: "5m", target: 350 },
                { duration: "5m", target: 500 },
                { duration: "10m", target: 500 },
            ],
            gracefulRampDown: "30s",
        },
    },
};

export function setup() {
    const loginRes = http.post(
        `${BASE_URL}/auth/login`,
        JSON.stringify({
            email: "empleado.load44@test.com",
            password: "12345678",
        }),
        {
            headers: {
                "Content-Type": "application/json",
            },
        }
    );

    const cookies = loginRes.cookies.access_token;

    if (!cookies || cookies.length === 0) {
        throw new Error("No se recibió la cookie access_token");
    }

    return {
        accessToken: cookies[0].value,
    };
}

export default function (data) {

    const params = {
        headers: {
            Cookie: `access_token=${data.accessToken}`,
        },
    };

    const responses = http.batch([
        ["GET", `${BASE_URL}/proyectos`, null, params],
        ["GET", `${BASE_URL}/horas`, null, params],
        ["GET", `${BASE_URL}/marcajes`, null, params],
    ]);

    check(responses[0], {
        "proyectos": (r) => r.status === 200,
    });

    check(responses[1], {
        "horas": (r) => r.status === 200,
    });

    check(responses[2], {
        "marcajes": (r) => r.status === 200,
    });

    sleep(0.2);
}