import express from 'express'; 
import bodyParser from 'body-parser';
import cors from 'cors';
import {calculateBmi} from './services/tools.service.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from "./generated/prisma/index.js";
import "dotenv/config"
const PORT = 3000;

const app = express();  
app.use(bodyParser.urlencoded({ 
    extended: true 
}));
app.use(bodyParser.json());
app.use(cors());
// Pregunta 1
app.get("/greetings/:name",function(req,resp){   
    const nombre = req.params.name;
    const lang = req.query.lang;
    if(lang === "es" || lang == undefined){
        resp.json({
            message: `Hola ${nombre}`
        });
        return;
    }
    if(lang === "en"){
        resp.json({
            message: `Hello ${nombre}`
        })
    }else if(lang === "pt"){
        resp.json({
            message: `Ola ${nombre}`
        })
    }else{
        resp.status(400).json({
            error: "Invalid language"   
        });
        return
    }
});
// Pregunta 1
app.post("/tools/bmi", function(req,resp){
    const { weight, height } = req.body;
    // const bmi = weight / (height / 100) ** 2;
    if(weight <= 0 || height <= 0){
        resp.status(400).json({
            error: "Weight and height must be positive numbers" 
        });
        return;
    }
    const imc = calculateBmi(height, weight);
    let category;

    if(imc < 18.5){
        category = "BAJO PESO";
    }else if(imc < 25){
        category = "PESO NORMAL";
    }else if (imc < 30){
        category = "SOBREPESO";
    }else{
        category = "OBESIDAD";
    }
    resp.json({
        bmi: imc,
        category: category
    });
    
});

const adapter = new PrismaPg({
    connectionString : process.env.DATABASE_URL
})
const prisma = new PrismaClient({adapter});

// Pregunta 2
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

        const resultado = arrProductos.map((producto) => ({
            ...producto,
            price: Number(producto.price)
        }));

        return resp.status(200).json(resultado);
    } catch (error) {
        console.error(error);

        return resp.status(500).json({
            message: "Error al consultar los productos"
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});