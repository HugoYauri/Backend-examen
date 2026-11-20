function roundTwoDecimals(value) {
    return Number(value.toFixed(2));
}

export function getDiscardedPractice(practices) {
    return Math.min(...practices);
}

export function calculateFinalGrade(practices, midterm, finalExam) {
    const practicesCopy = [...practices];
    const discardedPractice = getDiscardedPractice(practicesCopy);
    const discardedIndex = practicesCopy.indexOf(discardedPractice);

    practicesCopy.splice(discardedIndex, 1);

    const practicesAverage = practicesCopy.reduce(function (total, grade) {
        return total + grade;
    }, 0) / practicesCopy.length;

    const finalGrade = practicesAverage * 0.30 + midterm * 0.30 + finalExam * 0.40;

    return roundTwoDecimals(finalGrade);
}

export function getStatus(finalGrade) {
    return finalGrade >= 10.5 ? "APROBADO" : "DESAPROBADO";
}

export function paginate(items, page, limit) {
    const start = (page - 1) * limit;
    const end = start + limit;

    return {
        data: items.slice(start, end),
        total: items.length,
        totalPages: Math.ceil(items.length / limit)
    };
}

export function getCourseStats(grades) {
    if (grades.length === 0) {
        return {
            students: 0,
            average: null,
            highest: null,
            lowest: null,
            approvalRate: null
        };
    }

    const finalGrades = grades.map(function (grade) {
        return grade.finalGrade;
    });

    const sum = finalGrades.reduce(function (total, grade) {
        return total + grade;
    }, 0);

    const approved = grades.filter(function (grade) {
        return grade.status === "APROBADO";
    }).length;

    return {
        students: grades.length,
        average: roundTwoDecimals(sum / grades.length),
        highest: Math.max(...finalGrades),
        lowest: Math.min(...finalGrades),
        approvalRate: roundTwoDecimals((approved / grades.length) * 100)
    };
}
    