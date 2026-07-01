import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL =
    "https://sistema-de-rentabilidad-arb9c.ondigitalocean.app/api";

export const options = {
    scenarios: {
        carga_sostenida: {
            executor: "constant-vus",
            vus: 100,
            duration: "15m",
        },
    },
};

export function setup() {
    const loginRes = http.post(
        `${BASE_URL}/auth/login`,
        JSON.stringify({
            email: "fatima@propietario.com",
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
    const res = http.get(`${BASE_URL}/proyectos`, {
        headers: {
            Cookie: `access_token=${data.accessToken}`,
        },
    });

    check(res, {
        "status 200": (r) => r.status === 200,
    });

    sleep(1);
}