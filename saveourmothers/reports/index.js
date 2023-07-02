require('dotenv').config();
const mysql = require('mysql2/promise');

module.exports = async (context, req) => {

    var config = {
        host: '127.0.0.1',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
    };

    const conn = await mysql.createConnection(config);
    let resultData = {};

    try {
        conn.connect(
            function (err) {
                if (err) {
                    console.log("!!! Cannot connect !!! Error:");
                    throw err;
                }
                else {
                    console.log("Connection established.");
                    readData();
                }
            });

        let result = await conn.query(`
            SELECT COUNT(DISTINCT id) AS "Total Patients",
                COUNT(CASE WHEN sex = 'Male' THEN 1 END) AS "Male",
                COUNT(CASE WHEN sex = 'Female' THEN 1 END) AS "Female",
                COUNT(CASE WHEN sex = 'UNK' THEN 1 END) AS "Unknown"
            FROM patient_data;
        `);
        resultData.patients = result[0][0];

        result = await conn.query(`
            SELECT street AS "Neighborhood", 
                city, 
                COUNT(*) AS "Patients"
            FROM patient_data
            GROUP BY 1,2
            ORDER BY COUNT(*) DESC;
        `);
        resultData.locations = result[0];

        result = await conn.query(`
            SELECT drug,
                COUNT(DISTINCT drug) AS "Prescriptions"
            FROM prescriptions
            GROUP BY drug
            ORDER BY "Prescriptions" DESC
            LIMIT 10; 
        `);
        resultData.prescriptions = result[0];

        result = await conn.query(`
            SELECT COUNT(CASE WHEN DATEDIFF(NOW(), DOB) / 365.25 <= 5 THEN 1 ELSE NULL END) AS "5 and Under",
                COUNT(CASE WHEN DATEDIFF(NOW(), DOB) / 365.25 BETWEEN 5 AND 9 THEN 1 ELSE NULL END) AS "5 to 9",
                COUNT(CASE WHEN DATEDIFF(NOW(), DOB) / 365.25 >= 10 THEN 1 ELSE NULL END) AS "10 and Over"
            FROM patient_data;   
        `);
        resultData.ages = result[0][0];

        const responseJSON = {
            "data": resultData
        }
        context.res = {
            body: responseJSON,
            contentType: 'application/json'
        }
    } catch (err) {
        context.res = {
            status: 500
        };
        console.log(err);
    } finally {
        conn.end(
            function (err) {
                if (err) throw err;
                else console.log('Closing connection.')
            });
    }
}