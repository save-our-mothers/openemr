const sql = require('mssql');
require('dotenv').config();
const mysql = require('mysql2/promise');

module.exports = async (context, req) => {

    var config = {
        host: '127.0.0.1',
        user: 'root',
        password: 'root',
        database: 'openemr',
        port: 8320,
    };

    const conn = await mysql.createConnection(config);

    let queryResults = [];

    const readData = await conn.query(`SELECT 
        COUNT(DISTINCT id) AS "Total Patients",
            COUNT(CASE WHEN sex = 'Male' THEN 1 END) AS "Male",
            COUNT(CASE WHEN sex = 'Female' THEN 1 END) AS "Female",
            COUNT(CASE WHEN sex = 'UNK' THEN 1 END) AS "Unknown"
    FROM patient_data; `).then(results => {
        queryResults = results[0][0];
        console.log(queryResults);
    });
    conn.end(
        function (err) {
            if (err) throw err;
            else console.log('Closing connection.')
        });

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

    try {
        context.log('JavaScript HTTP trigger function processed a request.');

        // Add or change code here
        // context.log(result)

        // Construct response
        const responseJSON = {
            "data": queryResults
        }

        context.res = {
            // status: 200, /* Defaults to 200 */
            body: responseJSON,
            contentType: 'application/json'
        };
    } catch (err) {
        context.res = {
            status: 500
        };
        console.log(err);
    }

    // const config = {
    //     user: process.env.DB_USER,
    //     password: process.env.DB_PASSWORD,
    //     server: process.env.DB_SERVER, // better stored in an app setting such as process.env.DB_SERVER
    //     port: parseInt(process.env.DB_PORT), // optional, defaults to 1433, better stored in an app setting such as process.env.DB_PORT
    //     database: process.env.DB_NAME,
    //     options: {
    //         encrypt: true
    //     }
    // }

    // const dummyData = [

    // ]

    // sql.connect(config, async function (err) {
    //     if (err) console.log(err);

    //     // create Request object
    //     var request = new sql.Request();

    //     request.query(`
    //         SELECT p.HSPropertyId
    //             ,aq.Street
    //             ,c.CityName
    //             ,s.StateAbbr
    //             ,aq.Zip
    //             ,mkt.City
    //             ,ps.Name
    //             ,po.AdvertisedRent
    //             ,aq.Sqft
    //             ,aq.Beds
    //             ,aq.Baths
    //             ,aq.Lat
    //             ,aq.Long
    //         FROM Properties p
    //         LEFT JOIN Acquisitions aq ON p.PropertyId = aq.PropertyId
    //         LEFT JOIN Cities c ON aq.CityId = c.CityId
    //         LEFT JOIN States s ON aq.StateId = s.StateId
    //         LEFT JOIN PropertyStatusLogEntries psle ON p.PropertyStatusLogEntryId = psle.PropertyStatusLogEntryId
    //         LEFT JOIN PropertyStatuses ps ON psle.PropertyStatusId = ps.PropertyStatusId
    //         LEFT JOIN PropertyOccupancies po ON p.PropertyOccupancyId = po.PropertyOccupancyId
    //         LEFT JOIN Markets mkt ON aq.MarketId = mkt.MarketId
    //         LEFT JOIN AspNetUsers anu ON po.PMCompanyId = anu.Id
    //         WHERE ps.Name = 'MARKETING'
    //             AND anu.id = 'd7edeb1a-2896-48a7-8ead-38ed5f3a4ccd'
    //         ORDER BY psle.EntryDate
    //     `, async function (err, recordset) {

    //         if (err) console.log(err)

    //         // send records as a response
    //         console.log(recordset);
    //         result = recordset.recordsets;
    //     });
    // });

    // try {
    //     context.log('JavaScript HTTP trigger function processed a request.');

    //     // Add or change code here
    //     context.log(result)

    //     // Construct response
    //     const responseJSON = {
    //         "data": result
    //     }

    //     context.res = {
    //         // status: 200, /* Defaults to 200 */
    //         body: responseJSON.data[0],
    //         contentType: 'application/json'
    //     };
    // } catch (err) {
    //     context.res = {
    //         status: 500
    //     };
    // }
}