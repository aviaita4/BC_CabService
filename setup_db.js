var mongo = require('mongodb');

var MongoClient = require('mongodb').MongoClient;
var url = "mongodb://localhost:27017/";

database_name = "BC_mongoDB";

MongoClient.connect(url, function(err, db) {
  if (err) throw err;

  // Create Database
  var dbo = db.db(database_name);
  console.log("Database created : " + database_name + " at: " + url);
 
  // Create Collections
  dbo.createCollection("Drivers", function(err, res) {
    if (err) throw err;
    console.log("Drivers Collection created!");
  });

   dbo.createCollection("Riders", function(err, res) {
    if (err) throw err;
    console.log("Riders Collection created!");
  });

   dbo.createCollection("Ride_Request", function(err, res) {
    if (err) throw err;
    console.log("Ride_Request Collection created!");
  });

   dbo.createCollection("Quotations", function(err, res) {
    if (err) throw err;
    console.log("Quotations Collection created!");
  });

  db.close();
});