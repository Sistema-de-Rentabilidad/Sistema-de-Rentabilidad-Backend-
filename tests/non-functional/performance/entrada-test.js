import http from "k6/http";
import { check } from "k6";

// Cargar los tokens al inicio (se ejecuta una sola vez)
const sessions = JSON.parse(open("./tokens.json"));

export const options = {
    scenarios: {
        entrada: {
            executor: "per-vu-iterations",
            vus: 100,
            iterations: 1,
        },
    },
};

const BASE_URL =
    "https://sistema-de-rentabilidad-arb9c.ondigitalocean.app/api";

export default function () {
    const session =
        sessions[(__VU - 1) % sessions.length];

    const res = http.post(
        `${BASE_URL}/marcajes/entrada`,
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