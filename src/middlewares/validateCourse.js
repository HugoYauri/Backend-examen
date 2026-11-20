import { courses } from "../data/courses.data.js";

export function validateCourse(req, resp, next) {
    const courseId = req.params.courseId.toUpperCase();
    const course = courses.find(function (item) {
        return item.id === courseId;
    });

    if (course === undefined) {
        return resp.status(404).json({
            message: "Curso no encontrado"
        });
    }

    resp.locals.course = course;
    next();
}
