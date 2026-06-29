import http from "k6/http";
import { check } from "k6";

const sessions = JSON.parse(open("./tokens.json"));

export const options = {
    scenarios: {
        salida: {
            executor: "per-vu-iterations",
            vus: 100,
            iterations: 1,
        },
    },
};

const BASE_URL =
    "https://sistema-de-rentabilidad-arb9c.ondigitalocean.app/api";

export default function () {
    const session = sessions[__VU - 1];

    const res = http.post(
        `${BASE_URL}/marcajes/salida`,
        null,
        {
            headers: {
                Cookie: session.cookie,
            },
        }
    );

    check(res, {
        "status 200": (r) => r.status === 200,
    });
}