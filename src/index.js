import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { calculateBmi } from './services/tools.service.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from "./generated/prisma/index.js";
import { validateCourse } from "./middlewares/validateCourse.js";
import {
    calculateFinalGrade,
    getCourseStats,
    getDiscardedPractice,
    getStatus,
    paginate
} from "./services/grades.service.js";
import "dotenv/config";

const PORT = 3000;

const app = express();
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());
app.use(cors());

// Pregunta 1
app.get("/greetings/:name", function (req, resp) {
    const nombre = req.params.name;
    const lang = req.query.lang;
    if (lang === "es" || lang == undefined) {
        resp.json({
            message: "Hola " + nombre
        });
        return;
    }
    if (lang === "en") {
        resp.json({
            message: "Hello " + nombre
        });
    } else if (lang === "pt") {
        resp.json({
            message: "Ola " + nombre
        });
    } else {
        resp.status(400).json({
            error: "Invalid language"
        });
        return;
    }
});

// Pregunta 1
app.post("/tools/bmi", function (req, resp) {
    const { weight, height } = req.body;
    // const bmi = weight / (height / 100) ** 2;
    if (weight <= 0 || height <= 0) {
        resp.status(400).json({
            error: "Weight and height must be positive numbers"
        });
        return;
    }
    const imc = calculateBmi(height, weight);
    let category;

    if (imc < 18.5) {
        category = "BAJO PESO";
    } else if (imc < 25) {
        category = "PESO NORMAL";
    } else if (imc < 30) {
        category = "SOBREPESO";
    } else {
        category = "OBESIDAD";
    }
    resp.json({
        bmi: imc,
        category: category
    });
});

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL
});
const prisma = new PrismaClient({ adapter });

// Pregunta 2
app.get("/products", async function (req, resp) {
    const { category, minPrice, maxPrice, inStock } = req.query;

    const tieneMinPrice = minPrice !== undefined;
    const tieneMaxPrice = maxPrice !== undefined;

    const min = tieneMinPrice ? Number(minPrice) : undefined;
    const max = tieneMaxPrice ? Number(maxPrice) : undefined;

    if (
        (tieneMinPrice && !Number.isFinite(min)) ||
        (tieneMaxPrice && !Number.isFinite(max)) ||
        (tieneMinPrice && tieneMaxPrice && min > max)
    ) {
        return resp.status(400).json({
            message: "Formatos incorrectos de query parameter"
        });
    }

    const where = {};

    if (category !== undefined) {
        where.category = {
            equals: category,
            mode: "insensitive"
        };
    }

    if (tieneMinPrice || tieneMaxPrice) {
        where.price = {};

        if (tieneMinPrice) {
            where.price.gte = min;
        }

        if (tieneMaxPrice) {
            where.price.lte = max;
        }
    }

    if (inStock === "true") {
        where.stock = {
            gt: 0
        };
    }

    try {
        const arrProductos = await prisma.producto.findMany({
            where
        });

        const resultado = arrProductos.map(function (producto) {
            return {
                ...producto,
                price: Number(producto.price)
            };
        });

        return resp.status(200).json(resultado);
    } catch (error) {
        console.error(error);

        return resp.status(500).json({
            message: "Error al consultar los productos"
        });
    }
});

// Pregunta 3
function isValidGrade(grade) {
    return typeof grade === "number"
        && Number.isFinite(grade)
        && grade >= 0
        && grade <= 20;
}

app.post("/courses/:courseId/grades", validateCourse, function (req, resp) {
    const course = resp.locals.course;
    const body = req.body ?? {};
    const studentCode = body.studentCode;
    const studentName = body.studentName;
    const practices = body.practices;
    const midterm = body.midterm;
    const finalExam = body.final;

    const validStudentCode = typeof studentCode === "string"
        && /^\d{8}$/.test(studentCode);
    const validStudentName = typeof studentName === "string"
        && studentName.trim() !== "";
    const validPractices = Array.isArray(practices)
        && practices.length === 4
        && practices.every(function (grade) {
            return isValidGrade(grade);
        });

    if (
        !validStudentCode ||
        !validStudentName ||
        !validPractices ||
        !isValidGrade(midterm) ||
        !isValidGrade(finalExam)
    ) {
        return resp.status(400).json({
            message: "Datos de notas incorrectos"
        });
    }

    const existingStudent = course.grades.find(function (grade) {
        return grade.studentCode === studentCode;
    });

    if (existingStudent !== undefined) {
        return resp.status(409).json({
            message: "El alumno ya tiene notas registradas en este curso"
        });
    }

    const finalGrade = calculateFinalGrade(practices, midterm, finalExam);
    const record = {
        studentCode: studentCode,
        studentName: studentName.trim(),
        practices: [...practices],
        midterm: midterm,
        final: finalExam,
        discardedPractice: getDiscardedPractice(practices),
        finalGrade: finalGrade,
        status: getStatus(finalGrade)
    };

    course.grades.push(record);
    return resp.status(201).json(record);
});

app.get("/courses/:courseId/grades", validateCourse, function (req, resp) {
    const course = resp.locals.course;
    const status = req.query.status;
    const sort = req.query.sort ?? "desc";
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 5);

    if (
        status !== undefined &&
        status !== "APROBADO" &&
        status !== "DESAPROBADO"
    ) {
        return resp.status(400).json({
            message: "El status debe ser APROBADO o DESAPROBADO"
        });
    }

    if (sort !== "asc" && sort !== "desc") {
        return resp.status(400).json({
            message: "El sort debe ser asc o desc"
        });
    }

    if (
        !Number.isInteger(page) ||
        page <= 0 ||
        !Number.isInteger(limit) ||
        limit <= 0 ||
        limit > 20
    ) {
        return resp.status(400).json({
            message: "Page y limit deben ser enteros positivos; limit máximo 20"
        });
    }

    let grades = [...course.grades];

    if (status !== undefined) {
        grades = grades.filter(function (grade) {
            return grade.status === status;
        });
    }

    grades.sort(function (gradeA, gradeB) {
        if (sort === "asc") {
            return gradeA.finalGrade - gradeB.finalGrade;
        }
        return gradeB.finalGrade - gradeA.finalGrade;
    });

    const paginated = paginate(grades, page, limit);
    const data = paginated.data.map(function (grade) {
        return {
            studentCode: grade.studentCode,
            studentName: grade.studentName,
            finalGrade: grade.finalGrade,
            status: grade.status
        };
    });

    return resp.status(200).json({
        course: course.id,
        page: page,
        limit: limit,
        total: paginated.total,
        totalPages: paginated.totalPages,
        data: data
    });
});

app.get("/courses/:courseId/grades/:studentCode", validateCourse, function (req, resp) {
    const course = resp.locals.course;
    const studentCode = req.params.studentCode;
    const grade = course.grades.find(function (item) {
        return item.studentCode === studentCode;
    });

    if (grade === undefined) {
        return resp.status(404).json({
            message: "Alumno no encontrado en el curso"
        });
    }

    return resp.status(200).json(grade);
});

app.get("/courses/:courseId/stats", validateCourse, function (req, resp) {
    const course = resp.locals.course;
    const stats = getCourseStats(course.grades);

    return resp.status(200).json({
        course: course.id,
        students: stats.students,
        average: stats.average,
        highest: stats.highest,
        lowest: stats.lowest,
        approvalRate: stats.approvalRate
    });
});

app.listen(PORT, function () {
    console.log("Server is running on port " + PORT);
});
