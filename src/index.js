import express from 'express'; 
import bodyParser from 'body-parser';
import cors from 'cors';
import {calculateBmi} from './services/tools.service.js';
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

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});