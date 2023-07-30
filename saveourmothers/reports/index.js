const mysql = require('mysql2');
const Client = require('ssh2').Client;
require('dotenv').config();

module.exports = async (context, req) => {

    const sshConfig = {
        host: process.env.SSH_HOST,
        port: parseInt(process.env.SSH_PORT), // default SSH port
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

        // factory function to make objects to populate with totals for each year
        function yearFactory(year) {
            //Make base object with year from argument
            const yearObj = {
                year: year,
                year_total: 0,
            };
            //Add 52 weeks with a while loop
            let weekNum = 1;
            while (weekNum < 53) {
                yearObj[weekNum] = 0;
                weekNum++;
            };
            //Add 12 months (53-64) with a while loop
            let monthNum = 53;
            while (monthNum < 65) {
                yearObj[monthNum] = 0;
                monthNum++;
            };
            //Add 4 quarters (65-68) with a while loop
            let quarterNum = 65;
            while (quarterNum < 69) {
                yearObj[quarterNum] = 0;
                quarterNum++;
            }
            return yearObj;
        };

        //create object for each year by passing that year into yearFactory
        let y2021 = yearFactory(2021);
        let y2022 = yearFactory(2022);
        let y2023 = yearFactory(2023);
        let y2024 = yearFactory(2024);
        let y2025 = yearFactory(2025);
        let y2026 = yearFactory(2026);
        let y2027 = yearFactory(2027);
        let y2028 = yearFactory(2028);

        const yearsData = [
            { 2021: y2021 },
            { 2022: y2022 },
            { 2023: y2023 },
            { 2024: y2024 },
            { 2025: y2025 },
            { 2026: y2026 },
            { 2027: y2027 },
            { 2028: y2028 }
        ];



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

        queryText = `SELECT dashboard_date_d.year, DATE(form_encounter.date) AS "encounter date", dashboard_date_d.week_of_year, dashboard_date_d.month_of_year, dashboard_date_d.quarter
        FROM form_encounter
        JOIN dashboard_date_d ON DATE(form_encounter.date) = dashboard_date_d.date
        ORDER BY dashboard_date_d.year ASC;
        `;

        queryResult = await new Promise((resolve, reject) => {

            connection.query(queryText, (error, results, fields) => {
                if (error) reject(error);
                else resolve(results);
            });
        });

        let encounters = queryResult;

        encounters.forEach(encounter => {
            encounter.week_of_year = parseInt(encounter.week_of_year);
            encounter.month_of_year = parseInt(encounter.month_of_year);
        });

        for (let visit of encounters) {
            //pulls week, month, and quarter data
            let week = visit.week_of_year;
            let month = visit.month_of_year;
            let quarter = visit.quarter;
            //loops over array of y20xx objects
            for (let i = 0; i < yearsData.length; i++) {
                //if the year matches b/w visit and object of records for that year, increments each record.
                //year from visit is matched to relevant object by comparing the year of the visit
                //to the key and incrementing the corresponding properrty of the object in array yearsObject 
                if (visit.year == Object.keys(yearsData[i])[0]) {
                    //increments week total for that week (1 to 52)
                    yearsData[i][visit.year][week] += 1;

                    //increments month total for that month (53 to 64)
                    yearsData[i][visit.year][month + 52] += 1;
                    //incremenets quarter total for that quarter(65 to 68)
                    yearsData[i][visit.year][quarter + 64] += 1;
                    //increments year_total for that year
                    yearsData[i][visit.year].year_total += 1;
                }
            }
        }

        queryText = `SELECT dashboard_date_d.year, apptdate, dashboard_date_d.week_of_year, dashboard_date_d.month_of_year, dashboard_date_d.quarter
        FROM patient_tracker
        JOIN dashboard_date_d ON apptdate = dashboard_date_d.date
        ORDER BY dashboard_date_d.year ASC;
        `;

        queryResult = await new Promise((resolve, reject) => {

            connection.query(queryText, (error, results, fields) => {
                if (error) reject(error);
                else resolve(results);
            });
        });
        
        let appointments = queryResult;

        appointments.forEach(encounter => {
            encounter.week_of_year = parseInt(encounter.week_of_year);
            encounter.month_of_year = parseInt(encounter.month_of_year);
        });

        for (let visit of appointments) {
            //pulls week, month, and quarter data
            let week = visit.week_of_year;
            let month = visit.month_of_year;
            let quarter = visit.quarter;
            //loops over array of y20xx objects
            for (let i = 0; i < yearsData.length; i++) {
                //if the year matches b/w visit and object of records for that year, increments each record.
                //year from visit is matched to relevant object by comparing the year of the visit
                //to the key and incrementing the corresponding properrty of the object in array yearsObject 
                if (visit.year == Object.keys(yearsData[i])[0]) {
                    //increments week total for that week (1 to 52)
                    yearsData[i][visit.year][week] += 1;
                    //increments month total for that month (53 to 64)
                    yearsData[i][visit.year][month + 52] += 1;
                    //incremenets quarter total for that quarter(65 to 68)
                    yearsData[i][visit.year][quarter + 64] += 1;
                    //increments year_total for that year
                    yearsData[i][visit.year].year_total += 1;
                }
            }
        }

        queryResults.patient_visits = yearsData;

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
