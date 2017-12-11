var express = require('express');
var bodyParser = require('body-parser');
var app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
var validator = require('validator');
var mysql = require("mysql");

var crypto = require('./crypto.js');

var pool = mysql.createPool({
    connectionLimit: 10,
    host: "localhost",
    user: "root",
    password: "password",
    database: "billsplitter"
});

// All body of HTTP requests must be encoded in x-www-form-urlencoded

app.get('/', function (req, res) {
    res.end("Your result");
});

// Upload picture of bill
app.post('/bills', function (req, res) {
    // Parse body of request
    var userID = req.body.userID;
    var token = req.body.token;
    var picture = req.body.picture; // TODO see how to transport picture

    // Check for validity of inputs (see https://www.npmjs.com/package/validator)
    if (!validator.isInt(userID)) {
        console.log("Invalid user ID: ", userID);
        res.status(400).send('User id is invalid');
        return;
    }
    // TODO check for token and picture format

    // Check in database
    // TODO there should be no concurrent connection for this (auto increment problem)
    pool.query(
        "SELECT (id, token) FROM users WHERE id = ? AND token = ? LIMIT 1",
        [userID, token],
        function (error, result, fields) {
            console.log("POST /bills DB 1:", result); // TODO to remove
            if (error) {
                console.warn("The users table can't be searched:", error);
                res.status(500).send("Our database is having troubles");
            } else if (result.length === 0) { // Wrong userID or token
                console.log("User ID", userID, "with token", token, "does not exit");
                res.status(401).send("User ID and token combination is invalid");
            } else {
                // START OCR TODO TODO TODO
                // ************************************************
                var address = "50 W 4TH ST NEW YORK";
                var restaurant = "McDonald's";
                var tax = 19.5;
                var time = 1512428638; // epoch time obtained from bill

                var items = [
                    {
                        name: "Cheeseburger",
                        amount: 3.67 // tax not included ?
                    },
                    {
                        name: "Fries",
                        amount: 1.7
                    }
                ];
                // ************************************************
                // END OCR
                var name = restaurant; // TODO can be changed later
                var link = crypto.randomString(40); // ~zero chance it already exists
                pool.query(
                    "INSERT INTO bills (time, address, restaurant, name, tax, link) VALUES ?",
                    [time, address, restaurant, name, tax, link],
                    function (error, result) {
                        console.log("POST /bills DB 2:", result); // TODO to remove
                        if (error) {
                            console.warn("The new bill could not be created:", error);
                            res.status(500).send("Our database is having troubles");
                        } else {
                            pool.query(
                                "SELECT MAX(id) AS lastid FROM bills",
                                [],
                                function (error, result, fields) {
                                    console.log("POST /bills DB 3:", result); // TODO to remove
                                    if (error) {
                                        console.warn("The bills table could not be searched:", error);
                                        res.status(500).send("Our database is having troubles");
                                    } else {
                                        var billID = result[0].lastid;
                                        var values = [];
                                        items.forEach(function (item) {
                                            values.push([billID, item.name, item.amount]);
                                        });
                                        pool.query(
                                            "INSERT INTO items (bill_id, name, amount) VALUES ?",
                                            values,
                                            function (error, result, fields) {
                                                console.log("POST /bills DB 4:", result); // TODO to remove
                                                if (error) {
                                                    console.warn("The items could not be created:", error);
                                                    res.status(500).send("Our database is having troubles");
                                                } else {
                                                    pool.query(
                                                        "INSERT INTO bills_users (bill_id, user_id) VALUES ?",
                                                        [billID, userID],
                                                        function (error, result, fields) {
                                                            console.log("POST /bills DB 5:", result); // TODO to remove
                                                            if (error) {
                                                                console.warn("The bill - user could not be created:", error);
                                                                res.status(500).send("Our database is having troubles");
                                                            } else {
                                                                res.status(200).send("Bill created");
                                                            }
                                                        }
                                                    );
                                                }
                                            }
                                        );
                                    }
                                }
                            );
                        }
                    }
                );
            }
        }
    );
});

// Get bills where user is involved
app.get('/users/:userID/bills', function (req, res) {
    // Parse body of request
    var userID = req.userID;
    var token = req.body.token;
    
    // Check for validity of inputs (see https://www.npmjs.com/package/validator)
    if (!validator.isInt(userID)) {
        console.log("Invalid user ID: ", userID);
        res.status(400).send('User id is invalid');
        return;
    }

    // Check in database
    pool.query(
        "SELECT (id, token) FROM users WHERE id = ? AND token = ? LIMIT 1",
        [userID, token],
        function (error, result) {
            console.log("GET /users/:userID/bills 1:", result); // TODO to remove
            if (error) {
                console.warn("The users table can't be searched:", error);
                res.status(500).send("Our database is having troubles");
            } else if (result.length === 0) { // Wrong userID or token
                console.log("User ID", userID, "with token", token, "does not exit");
                res.status(401).send('User ID and token combination is invalid');
            } else {
                pool.query(
                    "SELECT bill_id FROM bills_users WHERE user_id = ?",
                    [userID],
                    function (error, result) {
                        console.log("GET /users/:userID/bills 2:", result); // TODO to remove
                        if (error) {
                            console.warn("The bills_users table can't be searched:", error);
                            res.status(500).send("Our database is having troubles");
                        } else {
                            console.log("User ID", userID, "has", result.length, "bills");
                            // TODO send the all the bills details
                            // just query bills_users, items and items_consumers tables
                            // TODO maybe query all in one query if possible
                            // res.status(200).send(bills);
                        }
                    }
                );
            }
        }
    );
});

// Get bill details
app.get('/bills/:billID', function (req, res) {
    // Parse body of request
    var billID = req.billID;
    var userID = req.body.userID;
    var token = req.body.token;

    // Check for validity of inputs (see https://www.npmjs.com/package/validator)
    if (!validator.isInt(userID)) {
        console.log("Invalid user ID: ", userID);
        res.status(400).send('User id is invalid');
        return;
    }

    // Check in database
    pool.query(
        "SELECT (id, token) FROM users WHERE id = ? AND token = ? LIMIT 1",
        [userID, token],
        function (error, result, fields) {
            console.log("GET /bills/:billID 1", result); // TODO to remove
            if (error) {
                console.warn("The users table can't be searched:", error);
                res.status(500).send("Our database is having troubles");
            } else if (result.length === 0) { // Wrong userID or token
                console.log("User ID", userID, "with token", token, "does not exit");
                res.status(401).send('User ID and token combination is invalid');
            } else {
                pool.query(
                    "SELECT * FROM bills WHERE bills.id = ?",
                    [billID],
                    function (error, result, fields) {
                        console.log("GET /bills/:billID 2", result); // TODO to remove
                        if (error) {
                            console.warn("The bills table can't be searched:", error);
                            res.status(500).send("Our database is having troubles");
                        } else if (result.length === 0) {
                            console.log("User ID", userID, "does not have bill with id", billID);
                            res.status(204).send('User ID has no such bill');
                        } else {
                            var bill = {
                                id:result[0].id,
                                time:result[0].time,
                                address:result[0].address,
                                restaurant:result[0].restaurant,
                                name:result[0].name,
                                tax:result[0].tax,
                                tip:result[0].tip,
                                link:result[0].link,
                                done:result[0].done
                            };
                            pool.query(
                                "SELECT bills_users.user_id AS id, users.username AS username FROM bills_users, users WHERE bills.id = ? AND bills_users.user_id = users.id",
                                [billID],
                                function (error, result, fields) {
                                    console.log("GET /bills/:billID 3", result); // TODO to remove
                                    if (error) {
                                        console.warn("The bills_users / users table can't be searched:", error);
                                        res.status(500).send("Our database is having troubles");
                                    } else {
                                        bills.users = result; // list of {id:x, username:xxx}s
                                        pool.query(
                                            "SELECT bills_users.temp_user_id AS id, temp_users.name AS username FROM bills_users, temp_users WHERE bills.id = ? AND bills_users.temp_user_id = temp_users.id",
                                            [billID],
                                            function (error, result, fields) {
                                                console.log("GET /bills/:billID 4", result); // TODO to remove
                                                if (error) {
                                                    console.warn("The bills_users / temp_users table can't be searched:", error);
                                                    res.status(500).send("Our database is having troubles");
                                                } else {
                                                    bills.tempUsers = result; // list of {id:x, username:xxx}s
                                                    pool.query(
                                                        "SELECT items.id AS id, items.name AS name, items.amount AS amount FROM items WHERE items.bill_id = ?",
                                                        [billID],
                                                        function (error, result, fields) {
                                                            console.log("GET /bills/:billID 5", result); // TODO to remove
                                                            if (error) {
                                                                console.warn("The items table can't be searched:", error);
                                                                res.status(500).send("Our database is having troubles");
                                                            } else {
                                                                bills.items = result;
                                                                pool.query(
                                                                    "SELECT items_consumers.* FROM items_consumers, items WHERE items.bill_id = ? AND items.id = items_consumers.item_id",
                                                                    [billID],
                                                                    function (error, result, fields) {
                                                                        console.log("GET /bills/:billID 6", result); // TODO to remove
                                                                        if (error) {
                                                                            console.warn("The items_consumers table can't be searched:", error);
                                                                            res.status(500).send("Our database is having troubles");
                                                                        } else {
                                                                            bills.consumers = result;
                                                                            // TODO send this object bills
                                                                        }
                                                                    }
                                                                );
                                                            }
                                                        }
                                                    );
                                                }
                                            }
                                        );
                                    }
                                }
                            );
                        }
                    }
                );
            }
        }
    );

// Sign in procedure
app.get('/users', function (req, res) {
    // Parse body of request
    var email = req.body.email;
    var password = req.body.password;
    
    // Check for validity of inputs (see https://www.npmjs.com/package/validator)
    email = validator.trim(email);
    password = validator.trim(password);    
    if (!validator.isEmail(email)) {
        console.log("Invalid email address for login:", email);
        res.status(400).send('Your email address is invalid');
        return;
    }
    email = validator.normalizeEmail(email);

    pool.query(
        "SELECT (id, digest, salt, token) FROM users WHERE email = ? LIMIT 1",
        [email],
        function (error, result, fields) {
            console.log("GET /users 1:", result); // TODO to remove
            if (error) {
                console.warn("The users table can't be searched:", error);
                res.status(500).send("Our database is having troubles");
            } else if (result.length === 0) { // email does not exist
                console.log("Email does not exist: ", email);
                res.status(401).send('Incorrect email or password');
            } else {
                var digest = crypto.scrypt(password, result[0].salt);
                if (digest != result[0].digest) {
                    console.log("Password is incorrect: ", password);
                    res.status(401).send('Incorrect email or password');
                } else {
                    res.status(200).send({userID: result[0].id, token: result[0].token});
                }
            }
        }
    );
});

// Sign up procedure
app.post('/users', function (req, res) {
    // Parses body of request
    var email = req.body.email;
    var username = req.body.username;
    var password = req.body.password;

    // Check for validity of inputs (see https://www.npmjs.com/package/validator)
    email = validator.trim(email);
    username = validator.trim(username);
    password = validator.trim(password);
    if (!validator.isEmail(email)) {
        console.log("Invalid email address for signup:", email);
        res.status(400).send('Your email is invalid');
        return;
    }
    email = validator.normalizeEmail(email);
    if (username.length < 4) {
        console.log("Username is too short:", username);
        res.status(400).send('Username is too short');
        return;
    } else if (username.length > 40) {
        console.log("Username is too long:", username);
        res.status(400).send('Username is too long');
        return;
    }
    if (password.length < 4) {
        console.log("Password is too short:", password);
        res.status(400).send('Password is too short');
        return;
    } else if (password.length > 100) {
        console.log("Password is too long:", password);
        res.status(400).send('Password is too long');
        return;
    }

    var emailExists = database.emailExists(email);
    if (emailExists) {
        console.log("Email already exists:", email);
        res.status(409).send('Email is already registered');
        return;
    }
    var usernameExists = database.usernameExists(username);
    if (usernameExists) {
        console.log("Username already exists:", username);
        res.status(409).send('Username is already taken');
        return;
    }
    
    // Create the user
    // TODO Add email verification
    var salt = crypto.randomString(8);
    var digest = crypto.scrypt(password, salt);
    var token = crypto.randomString(40);
    pool.query(
        "INSERT INTO users (email, username, digest, salt, token) VALUES ?",
        [email, username, digest, salt, token],
        function (error, result) {
            if (error) {
                console.warn("The user can't be created:", error);
                res.status(500).send("Our database is having troubles");
            } else {
                console.log("User", username, "created");
                res.status(201).send(token);
            }
        }
    );
});

app.get('/bills/:link', function (req, res) {
    // Parse body of request
    var link = req.link;

    if (link.length != 40) {
        console.log("Link provided is invalid: ", link);
        res.status(400).send('Link provided is invalid');
        return;
    }

    // Check in database
    pool.query(
        "SELECT bills.*, bills_users.*, items.*, items_consumers.*" +
        "FROM bills, bills_users, items, items_consumers " +
        "WHERE bills.link = ? AND bills_users.bill_id = bills.id AND " +
        "items.bill_id = bills.id AND items_consumers.item_id = items.id",
        [link],
        function (error, result) {
            console.log(result); // TODO to remove
            if (error) {
                console.warn("Error: ", error);
                res.status(500).send("Our database is having troubles");
            } else if (result == []) { // Link does not exist
                console.log("Link provided does not exist:", link);
                res.status(404).send('Link not found');
            } else {
                res.status(200).send(result); // TODO structure result
            }
        }
    );
});

/*
TODO
- Add user to bill
- Add temp user to bill
- Add user to an item, in items_consumers
- Add temp user to an item, in items_consumers
- Change paid status in items_consumers
- Specific information on one item of bill
*/

var server = app.listen(8000, function () {
    console.log("Server listening at localhost:%s", server.address().port);
});