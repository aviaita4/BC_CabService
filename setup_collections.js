var MongoClient = require('mongodb').MongoClient;
var url = "mongodb://localhost:27017/";

MongoClient.connect(url, function(err, db) {
  if (err) throw err;
  var dbo = db.db("book_db");

  dbo.createCollection("Drivers", function(err, res) {
    if (err) throw err;
    console.log("Collection created!");
    db.close();
  });

   dbo.createCollection("Riders", function(err, res) {
    if (err) throw err;
    console.log("Collection created!");
    db.close();
  });

    dbo.createCollection("Ride_Request", function(err, res) {
    if (err) throw err;
    console.log("Collection created!");
    db.close();
  });
    dbo.createCollection("Quotations", function(err, res) {
    if (err) throw err;
    console.log("Collection created!");
    db.close();
  });
});