var mongo = require('mongodb');

var MongoClient = require('mongodb').MongoClient;

database_name = "BC_mongoDB";
var url = "mongodb://localhost:27017/BC_mongoDB";

// Create Database

MongoClient.connect(url, function(err, db) {
  if (err) throw err;
  console.log("Database created!");
  db.close();
});

