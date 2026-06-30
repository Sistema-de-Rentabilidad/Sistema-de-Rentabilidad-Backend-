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
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZF91c3VhcmlvIjoyLCJlbWFpbCI6ImZhdGltYUBwcm9waWV0YXJpby5jb20iLCJyb2wiOiJwcm9waWV0YXJpbyIsImlkX2VtcHJlc2EiOjEsImlhdCI6MTc4Mjc4NjAwMiwiZXhwIjoxNzgyODcyNDAyLCJhdWQiOiJzaXN0ZW1hLWRlLXJlbnRhYmlsaWRhZC1jbGllbnQiLCJpc3MiOiJzaXN0ZW1hLWRlLXJlbnRhYmlsaWRhZC1iYWNrZW5kIiwic3ViIjoiMiJ9.cvqboSQDPlUxV4BdR1sxOTmYuUQDMIv4U9kySM-Ensk";

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