module.exports = {
    empresas: [
        {
            nombre: 'QA Tech SAC',
        },
        {
            nombre: 'Demo Company',
        },
        {
            nombre: 'Testing Corp',
        },
        {
            nombre: 'Fake Industries',
        },
    ],

    usuarios: [
        {
            nombre: 'QA Admin',
            email: 'qa_admin@test.com',
            rol: 'admin',
            id_empresa: null,
            is_active: true,
        },

        {
            nombre: 'QA Propietario',
            email: 'qa_propietario@test.com',
            rol: 'propietario',
            id_empresa: 1,
            is_active: true,
        },

        {
            nombre: 'QA Lider',
            email: 'qa_lider@test.com',
            rol: 'lider',
            id_empresa: 1,
            is_active: true,
        },

        {
            nombre: 'Primer QA Empleado',
            email: 'qa_empleado1@test.com',
            rol: 'empleado',
            id_empresa: 1,
            is_active: true,
        },

        {
            nombre: 'Segundo QA Empleado',
            email: 'qa_empleado2@test.com',
            rol: 'empleado',
            id_empresa: 1,
            is_active: true,
        },

        {
            nombre: 'Demo Propietario',
            email: 'demo_propietario@test.com',
            rol: 'propietario',
            id_empresa: 2,
            is_active: true,
        },

        {
            nombre: 'Demo Lider',
            email: 'demo_lider@test.com',
            rol: 'lider',
            id_empresa: 2,
            is_active: true,
        },

        {
            nombre: 'Primer Demo Empleado',
            email: 'demo_empleado1@test.com',
            rol: 'empleado',
            id_empresa: 2,
            is_active: true,
        },

        {
            nombre: 'Segundo Demo Empleado',
            email: 'demo_empleado2@test.com',
            rol: 'empleado',
            id_empresa: 2,
            is_active: true,
        },

        {
            nombre: 'Testing Propietario',
            email: 'testing_propietario@test.com',
            rol: 'propietario',
            id_empresa: 3,
            is_active: true,
        },

        {
            nombre: 'Testing Empleado',
            email: 'testing_empleado@test.com',
            rol: 'empleado',
            id_empresa: 3,
            is_active: true,
        },
    ],

    servicios: [
        {
            id_empresa: 1,
            nombre: 'Desarrollo Web',
            descripcion: 'Desarrollo de aplicaciones web empresariales',
            is_active: true,
        },

        {
            id_empresa: 1,
            nombre: 'Testing QA',
            descripcion: 'Pruebas funcionales y validación QA',
            is_active: true,
        },

        {
            id_empresa: 2,
            nombre: 'Consultoría TI',
            descripcion: 'Consultoría tecnológica para empresas',
            is_active: true,
        },

        {
            id_empresa: 2,
            nombre: 'Soporte Técnico',
            descripcion: 'Mantenimiento y soporte de sistemas',
            is_active: true,
        },

        {
            id_empresa: 3,
            nombre: 'Automatización QA',
            descripcion: 'Automatización de pruebas y procesos',
            is_active: true,
        },

        {
            id_empresa: 4,
            nombre: 'Análisis de Datos',
            descripcion: 'Servicios de análisis y reportes',
            is_active: false,
        },
    ],

    proyectos: [
        {
            id_empresa: 1,
            id_servicio: 1,
            id_lider: 3,
            nombre: 'Proyecto Alpha',
            descripcion: 'Sistema de control de rentabilidad',
            presupuesto: 12000,
            fecha_inicio: '2025-04-01',
            fecha_fin_estimada: '2025-07-01',
            fecha_fin_real: null,
            margen: 18,
            is_active: true,
        },

        {
            id_empresa: 1,
            id_servicio: 2,
            id_lider: 3,
            nombre: 'Proyecto Delta',
            descripcion: 'Implementación de pruebas QA',
            presupuesto: 8000,
            fecha_inicio: '2025-05-10',
            fecha_fin_estimada: '2025-08-15',
            fecha_fin_real: null,
            margen: 12,
            is_active: true,
        },

        {
            id_empresa: 1,
            id_servicio: 1,
            id_lider: 3,
            nombre: 'Proyecto Alpha Finalizado',
            descripcion: 'Sistema de control de rentabilidad',
            presupuesto: 12000,
            fecha_inicio: '2025-04-01',
            fecha_fin_estimada: '2025-07-01',
            fecha_fin_real: '2025-07-08',
            margen: 18,
            is_active: true,
        },

        {
            id_empresa: 2,
            id_servicio: 3,
            id_lider: 7,
            nombre: 'Proyecto Beta',
            descripcion: 'Consultoría para optimización de procesos',
            presupuesto: 15000,
            fecha_inicio: '2025-03-15',
            fecha_fin_estimada: '2025-06-30',
            fecha_fin_real: '2025-06-25',
            margen: 20,
            is_active: false,
        },

        {
            id_empresa: 3,
            id_servicio: 5,
            id_lider: 9,
            nombre: 'Proyecto Gamma',
            descripcion: 'Automatización de pruebas E2E',
            presupuesto: 20000,
            fecha_inicio: '2025-02-01',
            fecha_fin_estimada: '2025-09-01',
            fecha_fin_real: null,
            margen: 25,
            is_active: true,
        },
    ],

    fases: [
        {
            id_proyecto: 1,
            nombre: 'Análisis',
            horas_estimadas: 20,
            is_active: true,
        },

        {
            id_proyecto: 1,
            nombre: 'Desarrollo',
            horas_estimadas: 80,
            is_active: true,
        },

        {
            id_proyecto: 1,
            nombre: 'Testing',
            horas_estimadas: 40,
            is_active: true,
        },

        {
            id_proyecto: 2,
            nombre: 'Planificación',
            horas_estimadas: 15,
            is_active: true,
        },

        {
            id_proyecto: 2,
            nombre: 'Ejecución QA',
            horas_estimadas: 50,
            is_active: true,
        },

        {
            id_proyecto: 3,
            nombre: 'Consultoría Inicial',
            horas_estimadas: 30,
            is_active: false,
        },

        {
            id_proyecto: 4,
            nombre: 'Automatización',
            horas_estimadas: 90,
            is_active: true,
        },

        {
            id_proyecto: 4,
            nombre: 'Validación Final',
            horas_estimadas: 25,
            is_active: true,
        },
    ],

    notas: [
        {
            id_proyecto: 1,
            id_lider: 3,
            descripcion: 'Avance correcto del sprint 1',
            fecha: '2025-05-01',
            is_active: true,
        },

        {
            id_proyecto: 1,
            id_lider: 3,
            descripcion: 'Pendiente validación de módulos financieros',
            fecha: '2025-05-10',
            is_active: true,
        },

        {
            id_proyecto: 2,
            id_lider: 3,
            descripcion: 'Cliente aprobó las pruebas funcionales',
            fecha: '2025-05-15',
            is_active: true,
        },

        {
            id_proyecto: 3,
            id_lider: 7,
            descripcion: 'Proyecto finalizado dentro del presupuesto',
            fecha: '2025-06-20',
            is_active: false,
        },

        {
            id_proyecto: 4,
            id_lider: 9,
            descripcion: 'Automatización Cypress completada',
            fecha: '2025-05-22',
            is_active: true,
        },
    ],

    historialSueldos: [
        {
            id_usuario: 3,
            tipo_pago: 'mensual',
            monto: 4500,
            fecha_inicio: '2025-01-01',
            fecha_fin: null,
            horas_mensuales: 160,
        },

        {
            id_usuario: 4,
            tipo_pago: 'por_hora',
            monto: 25,
            fecha_inicio: '2025-01-01',
            fecha_fin: null,
            horas_mensuales: 160,
        },

        {
            id_usuario: 5,
            tipo_pago: 'por_hora',
            monto: 20,
            fecha_inicio: '2025-01-01',
            fecha_fin: null,
            horas_mensuales: 160,
        },

        {
            id_usuario: 7,
            tipo_pago: 'mensual',
            monto: 5000,
            fecha_inicio: '2025-02-01',
            fecha_fin: null,
            horas_mensuales: 160,
        },

        {
            id_usuario: 8,
            tipo_pago: 'por_hora',
            monto: 22,
            fecha_inicio: '2025-02-01',
            fecha_fin: null,
            horas_mensuales: 160,
        },
    ],

    proyectoEmpleados: [
        {
            id_proyecto: 1,
            id_empleado: 4,
        },

        {
            id_proyecto: 1,
            id_empleado: 5,
        },

        {
            id_proyecto: 2,
            id_empleado: 4,
        },

        {
            id_proyecto: 2,
            id_empleado: 5,
        },

        {
            id_proyecto: 3,
            id_empleado: 8,
        },

        {
            id_proyecto: 4,
            id_empleado: 10,
        },
    ],

    faseEmpleados: [
        {
            id_fase: 1,
            id_empleado: 4,
        },

        {
            id_fase: 2,
            id_empleado: 4,
        },

        {
            id_fase: 3,
            id_empleado: 5,
        },

        {
            id_fase: 4,
            id_empleado: 4,
        },

        {
            id_fase: 5,
            id_empleado: 5,
        },

        {
            id_fase: 7,
            id_empleado: 10,
        },
    ],

    marcajes: [
        {
            id_usuario: 4,
            fecha: '2025-05-20',
            hora_entrada: '2025-05-20 08:00:00',
            hora_salida: '2025-05-20 17:00:00',
        },

        {
            id_usuario: 5,
            fecha: '2025-05-20',
            hora_entrada: '2025-05-20 09:00:00',
            hora_salida: '2025-05-20 16:00:00',
        },

        {
            id_usuario: 10,
            fecha: '2025-05-21',
            hora_entrada: '2025-05-21 08:30:00',
            hora_salida: '2025-05-21 17:30:00',
        },
    ],

    registroHoras: [
        {
            id_empleado: 4,
            id_proyecto: 1,
            fecha: '2025-05-20',
            horas: 8,
            descripcion: 'Desarrollo de dashboard financiero',
            id_fase: 2,
        },

        {
            id_empleado: 5,
            id_proyecto: 1,
            fecha: '2025-05-20',
            horas: 6,
            descripcion: 'Pruebas funcionales módulo login',
            id_fase: 3,
        },

        {
            id_empleado: 4,
            id_proyecto: 2,
            fecha: '2025-05-21',
            horas: 4,
            descripcion: 'Planificación del sprint QA',
            id_fase: 4,
        },

        {
            id_empleado: 10,
            id_proyecto: 4,
            fecha: '2025-05-22',
            horas: 7,
            descripcion: 'Automatización de pruebas Cypress',
            id_fase: 7,
        },
    ],
};