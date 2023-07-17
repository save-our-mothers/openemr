const mysql = require('mysql2');
const Client = require('ssh2').Client;
require('dotenv').config();

module.exports = async (context, req) => {

    const sshConfig = {
        host: process.env.SSH_HOST,
        port: process.env.SSH_PORT, // default SSH port
        username: process.env.SSH_USER,
        privateKey: require('fs').readFileSync(process.env.SSH_KEY)
    };

    const dbConfig = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    };

    try {
        const ssh = new Client();
        await new Promise((resolve, reject) => {
            ssh.on('ready', resolve).on('error', reject);
            ssh.connect(sshConfig);
        });

        const stream = await new Promise((resolve, reject) => {
            ssh.forwardOut(
                '127.0.0.1',
                12345,
                dbConfig.host,
                3306,
                (err, stream) => {
                    if (err) reject(err);
                    else resolve(stream);
                }
            );
        });

        const connection = mysql.createConnection({
            host: 'localhost',
            user: dbConfig.user,
            password: dbConfig.password,
            database: dbConfig.database,
            stream: stream
        });

        let queryResults = {};

        let queryText = `SELECT 
            COUNT(DISTINCT id) AS "Total Patients",
                COUNT(CASE WHEN sex = 'Male' THEN 1 END) AS "Male",
                COUNT(CASE WHEN sex = 'Female' THEN 1 END) AS "Female",
                COUNT(CASE WHEN sex = 'UNK' THEN 1 END) AS "Unknown"
        FROM patient_data;`;

        let queryResult = await new Promise((resolve, reject) => {

            connection.query(queryText, (error, results, fields) => {
                if (error) reject(error);
                else resolve(results);
            });
        });

        queryResults.patients = queryResult[0];

        queryText = `SELECT street AS "Neighborhood", city, COUNT(*) AS "Patients"
            FROM patient_data
            GROUP BY 1,2
            ORDER BY COUNT(*) DESC;
        `;

        queryResult = await new Promise((resolve, reject) => {

            connection.query(queryText, (error, results, fields) => {
                if (error) reject(error);
                else resolve(results);
            });
        });

        queryResults.locations = queryResult;

        queryText = `SELECT
                COUNT(CASE WHEN DATEDIFF(NOW(), DOB) / 365.25 <= 5 THEN 1 ELSE NULL END) AS "5 and Under",
                COUNT(CASE WHEN DATEDIFF(NOW(), DOB) / 365.25 BETWEEN 6 AND 17 THEN 1 ELSE NULL END) AS "6 to 17",
                COUNT(CASE WHEN DATEDIFF(NOW(), DOB) / 365.25 BETWEEN 18 AND 30 THEN 1 ELSE NULL END) AS "18 to 30",
                COUNT(CASE WHEN DATEDIFF(NOW(), DOB) / 365.25 > 30 THEN 1 ELSE NULL END) AS "30+"
            FROM patient_data;
        `;

        queryResult = await new Promise((resolve, reject) => {

            connection.query(queryText, (error, results, fields) => {
                if (error) reject(error);
                else resolve(results);
            });
        });

        queryResults.ages = queryResult[0];

        queryText = `SELECT COUNT(drug) AS "Prescriptions", drug AS "Name"
            FROM prescriptions
            GROUP BY drug
            ORDER BY COUNT(drug) DESC
            LIMIT 10;
        `;

        queryResult = await new Promise((resolve, reject) => {

            connection.query(queryText, (error, results, fields) => {
                if (error) reject(error);
                else resolve(results);
            });
        });

        queryResults.prescriptions = queryResult;

        queryText = `SELECT
            COUNT(CASE WHEN family_size <= 5 THEN 1 ELSE NULL END) AS "1 to 5",
            COUNT(CASE WHEN family_size BETWEEN 5 AND 10 THEN 1 ELSE NULL END) AS "5 to 10",
            COUNT(CASE WHEN family_size > 10 THEN 1 ELSE NULL END) AS  "10+"
            FROM patient_data;
        `;

        queryResult = await new Promise((resolve, reject) => {

            connection.query(queryText, (error, results, fields) => {
                if (error) reject(error);
                else resolve(results);
            });
        });

        queryResults.familySize = queryResult[0];

        const responseJSON = {
            "data": queryResults
        }

        context.res = {
            body: responseJSON,
            contentType: 'application/json'
        }

        connection.end();
        ssh.end();
    } catch (error) {
        console.error('An error occurred:', error);
        context.res = {
            status: 500
        }
    }
};
