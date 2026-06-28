import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
    stages: [
        { duration: "1m", target: 20 },
        { duration: "1m", target: 50 },
        { duration: "1m", target: 100 },
        { duration: "30s", target: 0 },
    ],
};

const BASE_URL =
    "https://sistema-de-rentabilidad-arb9c.ondigitalocean.app/api";

// Cookie obtenida manualmente
const ACCESS_TOKEN =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZF91c3VhcmlvIjoxNywiZW1haWwiOiJsdWNpYS5yYW1pcmV6QGFuZGluYS1zZHIudGVzdCIsInJvbCI6InByb3BpZXRhcmlvIiwiaWRfZW1wcmVzYSI6NiwiaWF0IjoxNzgyNjgyNzAzLCJleHAiOjE3ODI3NjkxMDMsImF1ZCI6InNpc3RlbWEtZGUtcmVudGFiaWxpZGFkLWNsaWVudCIsImlzcyI6InNpc3RlbWEtZGUtcmVudGFiaWxpZGFkLWJhY2tlbmQiLCJzdWIiOiIxNyJ9.SQ8KZj1LyG4rjzYLW07Vi2vs6HEWo_9hy-d8BQAYNoU";

export default function () {
    const res = http.get(`${BASE_URL}/proyectos`, {
        headers: {
            Cookie: `access_token=${ACCESS_TOKEN}`,
        },
    });

    check(res, {
        "status 200": (r) => r.status === 200,
    });

    sleep(1);
}