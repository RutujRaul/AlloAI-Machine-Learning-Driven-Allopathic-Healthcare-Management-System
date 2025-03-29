const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const { Parser } = require("json2csv");

const app = express();
const PORT = 3000;
const SECRET_KEY = "secret123";

mongoose.connect("mongodb://localhost:27017/patientsDB", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const doctorSchema = new mongoose.Schema({
    username: String,
    password: String,
});

const patientSchema = new mongoose.Schema({
    name: String,
    age: Number,
    gender: String,
    medicalHistory: String,
    doctorNotes: String,
});

const Doctor = mongoose.model("Doctor", doctorSchema);
const Patient = mongoose.model("Patient", patientSchema);

app.use(cors());
app.use(express.json());
app.use(express.static("static"));


app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    const doctor = await Doctor.findOne({ username, password });
    if (!doctor) {
        return res.status(401).json({ error: "Invalid username or password" });
    }
    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: "1h" });
    res.json({ token });
});


const authenticate = (req, res, next) => {
    const token = req.query.token || req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(403).json({ error: "Access Denied" });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(403).json({ error: "Invalid Token" });
        req.user = decoded;
        next();
    });
};


app.post("/addPatient", authenticate, async (req, res) => {
    const { name, age, gender, medicalHistory, doctorNotes } = req.body;
    const newPatient = new Patient({ name, age, gender, medicalHistory, doctorNotes });
    await newPatient.save();
    res.json({ message: "Patient added successfully" });
});

app.get("/getPatients", authenticate, async (req, res) => {
    const patients = await Patient.find();
    res.json(patients);
});

app.put("/updatePatient/:id", authenticate, async (req, res) => {
    const { name, age, gender, medicalHistory, doctorNotes } = req.body;
    await Patient.findByIdAndUpdate(req.params.id, { name, age, gender, medicalHistory, doctorNotes });
    res.json({ message: "Patient updated successfully" });
});

app.delete("/deletePatient/:id", authenticate, async (req, res) => {
    await Patient.findByIdAndDelete(req.params.id);
    res.json({ message: "Patient deleted successfully" });
});


app.get("/searchPatients", authenticate, async (req, res) => {
    const query = req.query.q;
    const patients = await Patient.find({ name: new RegExp(query, "i") });
    res.json(patients);
});


app.get("/export/pdf", authenticate, async (req, res) => {
    const patients = await Patient.find();
    const doc = new PDFDocument();
    const filePath = "patients.pdf";
    doc.pipe(fs.createWriteStream(filePath));

    doc.fontSize(20).text("Patients Data", { align: "center" }).moveDown();
    patients.forEach((patient, index) => {
        doc.fontSize(12).text(`${index + 1}. ${patient.name}, ${patient.age}, ${patient.gender}`);
        doc.text(`Medical History: ${patient.medicalHistory}`);
        doc.text(`Doctor Notes: ${patient.doctorNotes}`).moveDown();
    });

    doc.end();
    res.download(filePath);
});


app.get("/export/csv", authenticate, async (req, res) => {
    const patients = await Patient.find();
    const json2csvParser = new Parser({ fields: ["name", "age", "gender", "medicalHistory", "doctorNotes"] });
    const csv = json2csvParser.parse(patients);

    fs.writeFileSync("patients.csv", csv);
    res.download("patients.csv");
});


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
