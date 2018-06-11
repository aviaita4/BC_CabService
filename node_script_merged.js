Web3 = require('web3');
web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

var fs = require('fs');
var express = require('express');
var app = express();
var bodyParser  = require('body-parser');
var mongo = require('mongodb');
var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectId; 
var url = "mongodb://localhost:27017/";

var dbo = {};

database_name = "book_db";

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

code = fs.readFileSync('Booking.sol').toString();
solc = require('solc');
compiledCode = solc.compile(code);

//console.log(compiledCode);

abiDefinition = JSON.parse(compiledCode.contracts[':Booking'].interface)
BookingContract = web3.eth.contract(abiDefinition)
byteCode = compiledCode.contracts[':Booking'].bytecode

web3.eth.defaultAccount = web3.eth.accounts[0]
//personal.unlockAccount(web3.eth.defaultAccount)

deployedContract = BookingContract.new({data: byteCode, from: web3.eth.accounts[0], gas: 4700000});

//deployedContract.address === undefined
//while(deployedContract.address === undefined){ console.log("test");}

function sleep (time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

// Usage!
sleep(500).then(() => {
    
   console.log("Contract deployed successfully!" + (deployedContract.address !== undefined));
   
   contractInstance = BookingContract.at(deployedContract.address);

   // #defines
   max_gas_allowed = 110000;


   MongoClient.connect(url, function(err, db) {
      if (err) throw err;
      dbo = db.db(database_name);;
   });

   // This responds with "Hello World" on the homepage
   app.get('/', function (req, res) {
      console.log("Got a GET request for the homepage");
      res.send('Hello GET');
   })

   // RIDER API -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

   // Create new ride request
   /*
   
      Headers: Content-Type : application/json
      Input JSON: rider_id, rider_source, rider_destination
      Response JSON: 
      {
         "request_id" : request_id
      }

   */
   app.post('/api/v2/rider/newRequest', function(req, res) {
       console.log("Creating new ride request for : " + req.body.rider_id);

       // Update in Mongo

       // Get request_id
       request_id = -1;
       quotesList = [];

       var myobj = {
           rider_id: req.body.rider_id,
           src_lat: req.body.rider_source.lat,
           src_lon: req.body.rider_source.lon,
           des_lat: req.body.rider_destination.lat,
           des_lon: req.body.rider_destination.lon
       };
       dbo.collection("Ride_Request").insert(myobj, function(err, result) {
           if (err) console.log(err);
           else {
               request_id = result["ops"][0]["_id"];

               // Update in Blockchain
               //contractInstance.createNewRequest.sendTransaction(request_id, req.body.rider_id, req.body.rider_source, req.body.rider_destination, {gas:max_gas_allowed});

               // Send response to user
               res_result = {
                   "request_id": request_id
               }
               res.send(JSON.stringify(res_result, null, 3));
               console.log("New ride request created: " + request_id + " for rider: " + req.body.rider_id);

               // Find nearby drivers in mongo
              req_location = {
                $geometry : {
                   type : "Point" ,
                   coordinates : [myobj.src_lat, myobj.src_lon] },
                $maxDistance : 1000
              }

              dbo.collection("Drivers").createIndex({curr_location:"2dsphere"}, function(err){

                  if(err){
                    console.log(err);
                    console.log("2dsphere index creation failed");
                  }

                  else{
                    dbo.collection("Drivers").find({curr_location: {$near:req_location}}).limit(10).toArray(function(err, docs) {
                       if(err) console.log(err, null);
                       else{
                        driveridlist = docs.map(function(doc){
                            return {"driver_id" : ObjectId(doc._id).toString(), "req_id" : request_id};
                        });
                        console.log("driveridlist",driveridlist);

                        if (!Array.isArray(driveridlist) || !driveridlist.length) {
                             console.log("No drivers present");
                         } else {

                             console.log("Drivers found nearby: Inserting into Quotations table");

                             //var driver_ids = driveridlist.map(function(id) { return id; });

                             dbo.collection("Quotations").insertMany(driveridlist, function(error, inserted) {
                                 if (error) {
                                     console.error(error);
                                 } else {
                                     console.log("Successfully inserted empty quotationns of nearby drivers: ", inserted);
                                 }
                             });
                         }
                       }
                   });
                  }
              });
           }
       })
   });


   // Poll quotations for created ride request
   /*
   
      Headers: Content-Type : application/json
      Input JSON: rider_id, request_id
      Response JSON: 

      [
         {
            "quotation_id": "",
            "driver_name": "",
            "driver_rating": "",
            "quotation_amount": ""
         },
         {
            "quotation_id": "",
            "driver_name": "",
            "driver_rating": "",
            "quotation_amount": ""
         }
      ]

   */
   app.get('/api/v2/rider/pollQuotations', function(req, res) {
      console.log("Polling rides for rider: " + req.query.rider_id + " for the ride: " + req.query.request_id);

      res_results = [];
      driveridlist = [];
      
      // Get results from Mongo DB
      qoute_amount: {$ne: null}
      //dbo.collection("Quotations").find({req_id: req.query.request_id , qoute_amount: {$ne: null}}).toArray(function(err, results) {
      dbo.collection("Quotations").find({req_id: req.query.request_id}).toArray(function(err, results) {
        if(err) console.log(err);
        else{
          all_quotations = results;

          if (results === undefined || results.length == 0) {
              console.log(err);
              res.send(JSON.stringify("Sorry, no nearby drivers found..", null, 3));
              console.log("Polling drivers " + " None exist!");
          } else {
            
            driveridlist = results.map(function(doc){
                            return doc.driver_id;
                        });
            console.log(driveridlist);
            var driver_ids = driveridlist.map(function(id) { return ObjectId(id); });

            dbo.collection("Drivers").find({_id: {$in: driver_ids}}).toArray(function(err, drivers){
              if(err) console.log(err);
              else{
                for (var i in driveridlist) {
                  if(drivers[i].status === "Idle"){
                    res_temp = {};
                    res_temp.quotation_id = all_quotations[i]._id;
                    res_temp.quotation_amount = all_quotations[i].quote_amount;
                    res_temp.driver_id = drivers[i]._id;
                    res_temp.driver_rating = drivers[i].driver_rating;
                    res_temp.driver_name = drivers[i].driver_name;

                    res_results.push(res_temp);  
                  }
                }

                res.send(JSON.stringify(res_results, null, 3));
                console.log("Polling results are returned successfully for rider: " + req.query.rider_id + " for the ride: " + req.query.request_id);
              }
            });
          }
        }
      });   
    });
 
 /*
          for (var i in driveridlist) { 
              await new Promise(next=> {
                dbo.collection("Drivers").findOne({_id : ObjectId(driveridlist[i])}, function(err, result){

                  if(err) console.log(err);
                  else{
                    if(result.status === "Idle"){
                      res_temp = {};
                      res_temp.quotation_id = results[i]._id;
                      res_temp.quotation_amount = results[i].quote_amount;
                      res_temp.driver_id = result._id;
                      res_temp.driver_rating = result.driver_rating;
                      res_temp.driver_name = result.driver_name;

                      res_results.push(res_temp);  
                    }
                  }
                });
              })

          }
          */
  
   // Select final quotation - for a rider for a rider
   /*
   
      Headers: Content-Type : application/json
      Input JSON: rider_id, request_id, final_quotation_id
      Response JSON: 
         
      {
         "booking_status" : "successful" / "unsuccessful"
      }
{"rider_id" : "5b1ec6dc76d0a6a3ecdd8918","request_id" : "5b1ef792d62244ab4918a57b","final_quotation_id" : "5b1ef792d62244ab4918a57c"}
   */
   app.post('/api/v2/rider/selectRide', function(req, res) {
      console.log("Selecting/Finalizing ride(quotation) : " + req.body.final_quotation_id + " for rider: " + req.body.rider_id);

      res_result = {
          "booking_status": "unsuccessful"
      }

      dbo.collection("Quotations").findOne({"_id": ObjectId(req.body.final_quotation_id)}, function(err, result) {

        if(err){
          console.log(err);
        }
        else {
          
          request_id = req.body.request_id;
          driver_id = result.driver_id;
          quote_id = req.body.final_quotation_id;

          dbo.collection("Drivers").findOne({"_id": ObjectId(driver_id)}, function(err, result) {

            if(err){
              console.log(err);
            }
            else {
              if(result.status === "Idle"){

                dbo.collection("Drivers").updateOne({"_id": ObjectId(driver_id)}, {$set:{status : "Selected", current_req_id : req.body.request_id}}, function(err, result) {});
                dbo.collection("Ride_Request").updateOne({"_id": ObjectId(request_id)}, {$set:{final_quote_id : quote_id}}, function(err, result) {});
                dbo.collection("Quotations").updateMany({"_id": ObjectId(quote_id)}, {$set:{invalid : "true"}}, function(err, result) {});                

                // Update final quotation in Blockchain
                /* if(res_result.booking_status === "successful"){
                    contractInstance.selectQuotation.sendTransaction(req.body.request_id, req.body.final_quotation_id, {gas:max_gas_allowed});   
                 }*/

                 res_result.booking_status = "successful";

                // Send response
                res.send(JSON.stringify(res_result, null, 3));
                console.log("Quotation finalized for rider: " + req.body.rider_id + " for the quotation: " + req.body.final_quotation_id);

              }else{
                res.send("Please retry: driver not available!");
              }
            }
          });
        }
      });  
});

   // DRIVER API -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

   // Driver update location
   /*
   
      Headers: Content-Type : application/json
      Input JSON: driver_id, driver_location
      

   */
   app.post('/api/v2/driver/updateLocation', function (req, res) {
      console.log("Updating driver location for driver : " + req.body.driver_id);

      res_result = {};

      res_result.message = "Some issue faced!"

      // Update in Mongo
      /*
      location: {
        type: "Point",
        coordinates: [req.body.driver_location.lat, req.body.driver_location.lon]
      }
      */

      curr_location = {lat : req.body.driver_location.lat, lon: req.body.driver_location.lon};

      dbo.collection("Drivers").updateOne({_id: ObjectId(req.body.driver_id)}, {$set:{curr_location : curr_location}}, function(err, result){
         if(err){
            console.log(err);

            res.send(JSON.stringify(res_result, null, 3));
            console.log("Update location for driver " + req.body.driver_id + " failed!");  
         }
         else {
            // Send response 

            res_result.message = "Location uodated successfully";
            res.send(JSON.stringify(res_result, null, 3));
            console.log("Update location for driver " + req.body.driver_id + " was successful!");
         } 

      });
   });


   // Poll nearby rides for a rider
   /*
   
      Headers: Content-Type : application/json
      Input JSON: driver_id
      Response JSON: 

      [
         {
            "quote_id"
            "request_source": "",
            "request_destination": "",
            "request_default_amount": ""
         },
         {
            "quote_id": "",
            "request_source": "",
            "request_destination": "",
            "request_default_amount": ""
         }
      ]

      // selected status
      {
         "req_id": ""
         "pickup_location": ""
      }

   */
   app.get('/api/v2/driver/pollRides', function (req, res) {
      console.log("Searching rides for driver: " + req.query.driver_id);

      // Get results from Mongo DB
      dbo.collection("Drivers").findOne({_id: ObjectId(req.query.driver_id)} , function(err, result){
         if(err)console.log(err);
         else {

            if(result == null){
               return;
            }

            console.log(result);

            if(result.status === "Idle"){
               dbo.collection("Quotations").find({driver_id: req.query.driver_id, invalid: null, quote_amount: null}).toArray(function(err, results){

               // Send response

               console.log(results);

               res.send(JSON.stringify(results, null, 3));
               console.log("Search rides for driver: "+ req.query.driver_id + " done");

               });
            }else if(result.status === "Selected"){
               req_id = result.current_req_id;

               dbo.collection("Ride_Request").findOne({_id: ObjectId(req_id)}, function(err, result){
                  if(err) console.log(err);
                  else{
                     // Send response
                     res_result = {};
                     res_result.req_id = req_id;
                     res_result.pickup_location = {
                        "lat" : result.src_lat,
                        "lon" : result.src_lon
                     }
                     res_result.dest_location = {
                        "lat" : result.des_lat,
                        "lon" : result.des_lon
                     }
                     res.send(JSON.stringify(res_result, null, 3));
                  }
               });
            }else{
               res.send("Sorry you got no rides!");
            }
         }
      });
   })


   // Add a quotation for a ride - by a driver
   /*
   
      Headers: Content-Type : application/json
      Input JSON: driver_id, request_id, quotation_amount, quotation_id
      Response JSON: 
         
      Quotation record completely

   */
   app.post('/api/v2/driver/addQuotation', function (req, res) {
      console.log("Creating quotation for driver : " + req.body.driver_id + " for the ride: " + req.body.request_id);

      // Update result
      dbo.collection("Quotations").updateOne({_id: ObjectId(req.body.quotation_id)}, {$set: {quote_amount : req.body.quotation_amount}}, function(err, result) {
         if(err)console.log(err);
         else {
               dbo.collection("Quotations").findOne({_id: ObjectId(req.body.quotation_id)} , function(err, result){
                  if(err)console.log(err);
                  else {
                        // Update final quotation in Blockchain
                        //contractInstance.addQuotation.sendTransaction(req.body.request_id, quotation_id, req.body.driver_id, req.body.quotation_amount, {gas:max_gas_allowed});

                        // Send response
                        res.send(JSON.stringify(result, null, 3));
                        console.log("Quotatation added :" + req.body.quotation_id + " for the ride: " + req.body.request_id + " by " + req.body.driver_id);
                  }
               });
         }
      });
   })


  // Confirm a ride after getting selected
   /*
   
      Headers: Content-Type : application/json
      Input JSON: driver_id, current_req_id
      Response JSON: 
         
      Quotation record completely

   */
   app.put('/api/v2/driver/confirmRide', function (req, res) {
      console.log("Confirming ride: " + req.body.current_req_id + " for driver: " + req.body.driver_id);

      // Update result
      dbo.collection("Drivers").updateOne({_id: ObjectId(req.body.driver_id)}, {$set:{status : "Busy" }} , function(err, result){
        if(err)console.log(err);
        else {
              // Send response
              res.send("Confirmed! Go pick your ride!");
              console.log("Confirmed ride: " + req.body.current_req_id + " for driver: " + req.body.driver_id);
        }
     });
   })

   // Registration API ---------------------------------------------------------------------------------------------------------------------------------------------------------------------

   // Register Rider
   /*
   
      Headers: Content-Type : application/json
      Input JSON: rider_name

   */

   app.post('/api/v4/register/rider', function (req, res) {

      console.log("Registration Started!");

      res_result = {
         "rider_id" : null,
         "rider_name" : req.body.rider_name
      };

      dbo.collection("Riders").insertOne({rider_name: req.body.rider_name}, function(err, result) {
         if(err){
            console.log(err);
            res.send("Registration unsuccessful! Sorry.. Please try again!");
         }
         else {
            res_result.rider_id = result["ops"][0]["_id"];
            res.send(JSON.stringify(res_result, null, 3));
         }
      });
      
      console.log("Registration Process Done!");

   });

   // Register Driver
   /*
   
      Headers: Content-Type : application/json
      Input JSON: driver_name

   */

   app.post('/api/v4/register/driver', function (req, res) {

      console.log("Registration Started!");

      res_result = {
         "driver_id" : null,
         "driver_name" : req.body.driver_name
      };

      dbo.collection("Drivers").insertOne({driver_name: req.body.driver_name, status : "idle"}, function(err, result) {
         if(err){
            console.log(err);
            res.send("Registration unsuccessful! Sorry.. Please try again!");
         }
         else {
            res_result.driver_id = result["ops"][0]["_id"];
            res.send(JSON.stringify(res_result, null, 3));
         }
      });
      
      console.log("Registration Process Done!");

   });

   // Default Pricing API ---------------------------------------------------------------------------------------------------------------------------------------------------------------------

   // Calculate price
   /*
   
      Headers: Content-Type : application/json
      Input JSON: source, destination, distance
      Response JSON: 
         
      {
         "price" : ""
         "cuurency" : "USD"
      }

   */

   app.get('/api/v3/price', function (req, res) {
      console.log("Calculating price from: " + req.query.source + " to " + req.query.destination + " with distance: " + req.query.distance);

      price_per_mile = 10;

      result = {
         "price" : 0,
         "currency" : "USD"
      }

      result.price = req.query.distance * price_per_mile;

      res.send(JSON.stringify(result, null, 3));

      console.log('Price calculated!');
   })

   // Transparency API ---------------------------------------------------------------------------------------------------------------------------------------------------------------------

   // API v1 -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

   app.get('/getTotalNumReqs', function (req, res) {
      num_reqs = contractInstance.getNumRequests();
      res.send('Toral Requests: ' + num_reqs);
   })

   app.post('/api/v1/createNewRequest', function (req, res) {
      console.log("Creating brand new request!");

      contractInstance.createNewRequest.sendTransaction(req.body.request_id, req.body.rider_id, req.body.source, req.body.destination, {gas:max_gas_allowed});

      res.send('New Request Created');
   })   

   app.post('/api/v1/addQuotation', function (req, res) {
      console.log("Creating quotation for request");

      contractInstance.addQuotation.sendTransaction(req.body.request_id, req.body.quotation_id, req.body.driver_id, req.body.quotation_amount, {gas:max_gas_allowed});

      res.send('Created a quotation!');
   })

   app.get('/api/v1/getAllQuotationDetails', function (req, res) {
      console.log("Getting all quotation details of a request");

      result = [];
      console.log(req);
      console.log(req.query.request_id);
      quotation_map_ids = contractInstance.getAllQuotations(req.query.request_id);
      for (var i in quotation_map_ids) {
        temp = contractInstance.getQuotationDetails(req.query.request_id, quotation_map_ids[i]);
        json_temp = {
            'Quatation ID' : temp[0],
            'Driver ID' : temp[1],
            'Amount':temp[2]
        }
        result.push(json_temp);
      }

      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(result, null, 3));
   })

   var server = app.listen(8081, function () {

      var host = server.address().address
      var port = server.address().port

      console.log("Booking test app listening at http://%s:%s", host, port)
   })

});