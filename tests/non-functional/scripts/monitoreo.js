import http from "k6/http";
import { sleep } from "k6";

const BASE_URL =
    "https://sistema-de-rentabilidad-arb9c.ondigitalocean.app/api";

export const options = {
    vus: 1,
    duration: "10m",
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
    const res = http.get(`${BASE_URL}/auth/me?t=${Date.now()}`, {
        headers: {
            Connection: "close",
            Cookie: `access_token=${data.accessToken}`,
        },
    });

    console.log(
        `${new Date().toISOString()} | ${res.status} | ${res.error || "OK"}`
    );

    sleep(0.1);
}