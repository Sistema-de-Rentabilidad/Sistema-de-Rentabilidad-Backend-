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

const users = [
    // 1 Admin
    { email: "admin@admin.com", password: "12345678"},

    // 3 Propietario
    { email: "fatima@propietario.com", password: "12345678"},
    { email: "juan@propietario.com", password: "12345678"},
    { email: "lucia.ramirez@andina-sdr.test", password: "12345678"},

    // 3 Líder
    { email: "jeremy@lider.com", password: "12345678"},
    { email: "melisa@lider.com", password: "12345678"},
    { email: "diego.salazar@andina-sdr.test", password: "12345678"},
];

// 13 propietarios
for (let i = 1; i <= 13; i++) {
    users.push({
        email: `propietario.carga${i}@test.com`,
        password: "12345678",
    });
}

// 30 líderes
for (let i = 1; i <= 30; i++) {
    users.push({
        email: `lider.carga${i}@test.com`,
        password: "12345678",
    });
}

// 50 empleados
for (let i = 1; i <= 50; i++) {
    users.push({
        email: `empleado.carga${i}@test.com`,
        password: "12345678",
    });
}

export default function () {
    const user = users[(__VU - 1) % users.length];

    const payload = JSON.stringify({
        email: user.email,
        password: user.password,
    });

    const res = http.post(
        "https://sistema-de-rentabilidad-arb9c.ondigitalocean.app/api/auth/login",
        payload,
        {
            headers: {
                "Content-Type": "application/json",
            },
        }
    );

    check(res, {
        "status 200": (r) => r.status === 200,
    });

    sleep(1);
}