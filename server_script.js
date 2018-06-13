Web3 = require('web3');
web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

var fs = require('fs');
var express = require('express');
var app = express();
var bodyParser  = require('body-parser');

var mongo = require('mongodb');
var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectId; 
var dbo = {};
var url = "mongodb://localhost:27017/";

var cors = require('cors')
app.use(cors())

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

internal_error_message = {"message" : "Some issue faced! Please try again"};
error_message_json = JSON.stringify(internal_error_message, null, 3);

function sleep (time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

sleep(500).then(() => {
    
   // Contract instance 
   console.log("Contract deployed successfully! - " + (deployedContract.address !== undefined));
   contractInstance = BookingContract.at(deployedContract.address);
   
   console.log(contractInstance);

   // #define: allowed gas per transaction 
   max_gas_allowed = 200000;

   // DB connection instance
   MongoClient.connect(url, function(err, db) {
      if (err) throw err;
      dbo = db.db(database_name);;
   });

   // Host up! API check
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

    request_id = -1;
    quotesList = [];

    var myobj = {
       rider_id: req.body.rider_id,
       src_lat: req.body.rider_source.lat,
       src_lon: req.body.rider_source.lon,
       des_lat: req.body.rider_destination.lat,
       des_lon: req.body.rider_destination.lon
    };

    dbo.collection("Riders").findOne({_id : ObjectId(myobj.rider_id)}, function(err, result){
      if (err){
        console.log(err);
        res.status(500).send(error_message_json);
      }else{

        if(result == null){
          res_result = {};
          res_result.message = "Not authorized! Rider not found in DB!";
          res.status(500).send(res_result);
          console.log(res_result.message);
        }else{
          dbo.collection("Ride_Request").insert(myobj, function(err, result) {
           if (err){
            console.log(err);
            res.status(500).send(error_message_json);
           }
           else {
            request_id = result["ops"][0]["_id"];

            // Update in Blockchain
            p1 = String(request_id);
            p2 = String(req.body.rider_id);
            p3 = String(req.body.rider_source.lat).replace("-","/").replace(".","@");
            p4 = String(req.body.rider_source.lon).replace("-","/").replace(".","@");
            p5 = String(req.body.rider_destination.lat).replace("-","/").replace(".","@");
            p6 = String(req.body.rider_destination.lon).replace("-","/").replace(".","@");
            //p3 = web3.toHex(req.body.rider_source.lat).replace("-","[");
            //p4 = web3.toHex(req.body.rider_source.lon).replace("-","[");
            //p5 = web3.toHex(req.body.rider_destination.lat).replace("-","[");
            //p6 = web3.toHex(req.body.rider_destination.lon).replace("-","[");

            contractInstance.createNewRequest.sendTransaction(p1, p2, p3, p4, p5, p6, {gas:max_gas_allowed});

            res_result = {
             "request_id": request_id
            }
            res.send(JSON.stringify(res_result, null, 3));
            console.log("New ride request created: " + request_id + " for rider: " + req.body.rider_id);

            // Find nearby drivers in mongo
            req_location = {
            $geometry : {
             type : "Point" ,
             coordinates : [myobj.src_lon, myobj.src_lat] },
            $maxDistance : 1000
            }

            // dbo.collection("Drivers").createIndex({curr_location:"2dsphere"}, 
            //   function(err){

            if(false){
              console.log(err);
              console.log("2dsphere index creation failed");
            }

            else{
              dbo.collection("Drivers").find({curr_location: {$near:req_location}}).limit(10).toArray(function(err, docs) {
              if (err){
                console.log(err);
                res.status(500).send(error_message_json);
              }else{
                driveridlist = docs.map(function(doc){
                  return {"driver_id" : ObjectId(doc._id).toString(), "req_id" : request_id.toString()};
                });
                console.log("driveridlist", driveridlist);

                if (!Array.isArray(driveridlist) || !driveridlist.length) {
                   console.log("No drivers present");
                } else {

                  console.log("Drivers found nearby: Inserting empty fields into Quotations table");

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
         }
      });
        }
      }
    });
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
            "driver_car": "",
            "location": {
                "lat" : ,
                "lon" : 
            },
            "quotation_amount": ""
         },
         {
            "quotation_id": "",
            "driver_name": "",
            "driver_rating": "",
            "driver_car": "",
            "location": {
                "lat" : ,
                "lon" : 
            },
            "quotation_amount": ""
         }
      ]

   */
   app.get('/api/v2/rider/pollQuotations', function(req, res) {
      console.log("Polling rides for rider: " + req.query.rider_id + " for the ride: " + req.query.request_id);

      res_results = [];
      driveridlist = [];
      
      qoute_amount: {$ne: null}
      dbo.collection("Quotations").find({req_id: req.query.request_id}).toArray(function(err, results) {
        if (err){
          console.log(err);
          res.status(500).send(error_message_json);
        }
        else{
          all_quotations = results;

          if (results === undefined || results.length == 0) {
              console.log(err);
              res.status(402);
              res.send({message: 'No Drivers'});
              console.log("Polling drivers " + " None exist!");
          } else {
            
            driveridlist = results.map(function(doc){
                            return doc.driver_id;
                        });

            console.log(driveridlist);
            var driver_ids = driveridlist.map(function(id) { return ObjectId(id); });

            dbo.collection("Drivers").find({_id: {$in: driver_ids}}).toArray(function(err, drivers){
              if (err){
                console.log(err);
                res.status(500).send(error_message_json);
              }
              else{
                for (var i in driveridlist) {
                  if(drivers[i].status === "idle"){
                    res_temp = {};
                    res_temp.quotation_id = all_quotations[i]._id;
                    res_temp.quotation_amount = all_quotations[i].quote_amount;
                    res_temp.driver_id = drivers[i]._id;
                    res_temp.driver_car = drivers[i].driver_car;
                    res_temp.driver_rating = drivers[i].driver_rating;
                    res_temp.driver_name = drivers[i].driver_name;
                    res_temp.location = drivers[i].curr_location;

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
  
   // Select final quotation - for a rider for a rider
   /*
   
      Headers: Content-Type : application/json
      Input JSON: {"rider_id" : "5b1ec6dc76d0a6a3ecdd8918","request_id" : "5b1ef792d62244ab4918a57b","final_quotation_id" : "5b1ef792d62244ab4918a57c"}
      Response JSON: 
         
      {
         "booking_status" : "successful" / "unsuccessful"
      }

   */
   app.post('/api/v2/rider/selectRide', function(req, res) {
      console.log("Selecting/Finalizing ride(quotation) : " + req.body.final_quotation_id + " for rider: " + req.body.rider_id);

      res_result = {
          "booking_status": "unsuccessful"
      }

      dbo.collection("Quotations").findOne({"_id": ObjectId(req.body.final_quotation_id)}, function(err, result) {

        if (err){
          console.log(err);
          res.status(500).send(error_message_json);
        }else {
          
          request_id = req.body.request_id;
          driver_id = result.driver_id;
          quote_id = req.body.final_quotation_id;

          dbo.collection("Drivers").findOne({"_id": ObjectId(driver_id)}, function(err, result) {

            if (err){
              console.log(err);
              res.status(500).send(error_message_json);
            }else {
              if(result.status === "idle"){

                // MAKE THIS INTO A SINGLE TRANSACTION WITH LOCK

                dbo.collection("Drivers").updateOne({"_id": ObjectId(driver_id)}, {$set:{status : "Selected", current_req_id : req.body.request_id}}, function(err, result) {});
                dbo.collection("Ride_Request").updateOne({"_id": ObjectId(request_id)}, {$set:{final_quote_id : quote_id}}, function(err, result) {});
                dbo.collection("Quotations").updateMany({"_id": ObjectId(quote_id)}, {$set:{invalid : "true"}}, function(err, result) {});                

                // Update final quotation in Blockchain
                p1 = String(req.body.request_id);
                p2 = String(req.body.final_quotation_id);
                contractInstance.selectQuotation.sendTransaction(p1, p2, {gas:max_gas_allowed});
                //contractInstance.selectQuotation.sendTransaction(req.body.request_id, req.body.final_quotation_id, {gas:max_gas_allowed});   

                // Send response
                res_result.booking_status = "successful";
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
      Response JSON: 
         
      {
         "message" : "Location updated successfully"
      }

   */
   app.post('/api/v2/driver/updateLocation', function (req, res) {
      console.log("Updating driver location for driver : " + req.body.driver_id);

      res_result = {};

      curr_location = {lat : req.body.driver_location.lon, lon: req.body.driver_location.lat};

      dbo.collection("Drivers").updateOne({_id: ObjectId(req.body.driver_id)}, {$set:{curr_location : curr_location}}, function(err, result){
         if (err){
          console.log(err);
          res.status(500).send(error_message_json);
         }else {
          if(result.matchedCount!=0){
            console.log(result.matchedCount);
            res_result.message = "Location updated successfully";
            res.send(JSON.stringify(res_result, null, 3));
            console.log("Update location for driver " + req.body.driver_id + " was successful!");
          }else{
            res_result.message = "Something went wrong! (Driver not found?)";
            res.send(JSON.stringify(res_result, null, 3));
            console.log(res_result.message);
          }
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
            "_id" : //quotation id
            "rider_name" : 
            "src": {
              "lat":
              "lon":
            },
            "des": {
              "lat":
              "lon":
            },
            "default_amount": ""
         },
         {
            "_id" : //quotation id
            "rider_name" : 
            "src": {
              "lat":
              "lon":
            },
            "des": {
              "lat":
              "lon":
            },
            "default_amount": ""
         },
      ]

      // selected status
      {
        "message" : "Selected for a ride"
        "req_id": ""
        "pickup_location": {
          "lat":
          "lon":
        }
        "dest_location": {
          "lat":
          "lon":
        }
      }

   */
   app.get('/api/v2/driver/pollRides', function (req, res) {
      console.log("Searching rides for driver: " + req.query.driver_id);

      res_result = [];
      dbo.collection("Drivers").findOne({_id: ObjectId(req.query.driver_id)} , function(err, result){
        if (err){
          console.log(err);
          res.status(500).send(error_message_json);
        }else {
          if(result == null){
            res_result = {};
            res_result.message = "Driver not found";
            res.status(500).send(JSON.stringify(res_result, null, 3));
            console.log(res_result.message);
          }else{
            if(result.status === "idle"){
              dbo.collection("Quotations").find({driver_id: req.query.driver_id, invalid: null, quote_amount: null}).toArray(function(err, results){
                if (err){
                  console.log(err);
                  res.status(500).send(error_message_json);
                }else{
                  if(!Array.isArray(results) || !results.length){
                    res_result = {};
                    res_result.message = "No riders available";
                    res.send(JSON.stringify(res_result, null, 3));
                    console.log(res_result.message);
                  }else{

                    ReqID_list = results.map(function(doc){
                        return ObjectId(doc.req_id);
                      });

                    quote_id_list = results.map(function(doc){
                        return doc._id;
                      });

                    for(var i in results){
                      temp_res = {"_id" : quote_id_list[i], "rider_name" : "not_chosen_yet" ,"req_id" : ReqID_list[i], "src": { "lat": 0, "lon": 0}, "des": { "lat": 0, "lon": 0}, default_amount : 0};
                      res_result.push(temp_res);
                    }

                    dbo.collection("Ride_Request").find({_id: {$in: ReqID_list}}).toArray(function(err, results){
                      if (err){
                        console.log(err);
                        res.status(500).send(error_message_json);
                      }else{
                        console.log("Requests mapped for driver: ");
                        console.log(results);

                        riders_list = results.map(function(doc){
                            return ObjectId(doc.rider_id);
                        });

                        for(var i in res_result){
                              res_result[i].src = {'lat' : results[i].src_lat, 'lon' : results[i].src_lon};
                              res_result[i].des = {'lat' : results[i].des_lat, 'lon' : results[i].des_lon};

                              // TODO: CHANGE LOGIC FOR DEFAULT AMOUNT
                              res_result[i].default_amount = 100;
                        }

                        // UN-COMMENT THIS SECTION IF RIDER TABLE SHOULD NOT BE INTERACTED
                        /*
                        res.send(JSON.stringify(res_result, null, 3));
                        console.log("Search rides for driver: "+ req.query.driver_id + " done");
                        */

                        console.log(riders_list);
                        // COMMENT THIS SECTION IF RIDER TABLE SHOULD NOT BE INTERACTED
                        dbo.collection("Riders").find({_id: {$in: riders_list}}).toArray(function(err, results){
                          if (err){
                            console.log(err);
                            res.status(500).send(error_message_json);
                          }else{
                            console.log(results);
                            console.log(res_result);
                            for(var i in res_result){
                              res_result[i].rider_name = results[i].rider_name;
                            }
                           res.send(JSON.stringify(res_result, null, 3));
                           console.log("Search rides for driver: "+ req.query.driver_id + " done");
                          }
                        });

                      }
                    });
                  }
                }
              });  
            }else if(result.status === "Selected"){
              curr_req_id = result.current_req_id;
              dbo.collection("Ride_Request").findOne({_id: ObjectId(curr_req_id)}, function(err, result){
                if (err){
                  console.log(err);
                  res.status(500).send(error_message_json);
                }
                else{
                  res_result = {};
                  res_result.message = "Selected for a ride";
                  res_result.req_id = curr_req_id;
                  res_result.pickup_location = {
                    "lat" : result.src_lat,
                    "lon" : result.src_lon
                  }
                  res_result.dest_location = {
                    "lat" : result.des_lat,
                    "lon" : result.des_lon
                  }
                  res.send(JSON.stringify(res_result, null, 3));
                  console.log("Ride got selected: " + res_result);
                }
              });
            }else{
              res_result = {};
              res_result.message = "No riders available";
              res.send(JSON.stringify(res_result, null, 3));
              console.log(res_result.message);
            }
          }          
        }
      });
   })


   // Add a quotation for a ride - by a driver
   /*
   
      Headers: Content-Type : application/json
      Input JSON: driver_id, request_id, quotation_amount, quotation_id
      Response JSON:

      {
        Quotation table complete row
      } 
         
   */
  app.post('/api/v2/driver/addQuotation', function (req, res) {
    console.log("Creating quotation for driver : " + req.body.driver_id + " for the ride: " + req.body.request_id);

    dbo.collection("Quotations").updateOne({_id: ObjectId(req.body.quotation_id)}, {$set: {quote_amount : req.body.quotation_amount}}, function(err, result) {
      if (err){
        console.log(err);
        res.status(500).send(error_message_json);
      }
      else {
        dbo.collection("Quotations").findOne({_id: ObjectId(req.body.quotation_id)} , function(err, result){
          if (err){
            console.log(err);
            res.status(500).send(error_message_json);
          }
          else {
            // Update final quotation in Blockchain
            p1 = String(req.body.request_id);
            p2 = String(req.body.quotation_id);
            p3 = String(req.body.driver_id);
            p4 = (req.body.quotation_amount);
            contractInstance.addQuotation.sendTransaction(p1, p2, p3, p4, {gas:max_gas_allowed});
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
      Response : {
        "message" : "Confirmed! Go pick your ride!"
      }
         
   */
   app.put('/api/v2/driver/confirmRide', function (req, res) {
      console.log("Confirming ride: " + req.body.current_req_id + " for driver: " + req.body.driver_id);

      dbo.collection("Drivers").updateOne({_id: ObjectId(req.body.driver_id)}, {$set:{status : "Busy" }} , function(err, result){
        if(err)console.log(err);
        else {

          res_result = {};
          res_result.message = "Confirmed! Go pick your ride!";

          res.send(JSON.stringify(res_result, null, 3));
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

      res_result = {};
      res_result.rider_name = req.body.rider_name;

      dbo.collection("Riders").insertOne({rider_name: req.body.rider_name}, function(err, result) {
         if(err){
            console.log(err);
            res.send("Registration unsuccessful! Sorry.. Please try again!");
         }
         else {
            res_result.rider_id = result["ops"][0]["_id"];
            console.log("Registration Process Done for rider: " + req.body.rider_name + " - id: " + result["ops"][0]["_id"]);
            res.send(JSON.stringify(res_result, null, 3));
         }
      });
   });

   // Register Driver
   /*
   
      Headers: Content-Type : application/json
      Input JSON: driver_name, driver_car (optional)

   */

   app.post('/api/v4/register/driver', function (req, res) {

      console.log("Registration Started!");

      res_result = {};
      res_result.driver_name = req.body.driver_name;

      car = "Toyota Limo";

      if(req.body.driver_car){
        car = req.body.driver_car;
      }

      dbo.collection("Drivers").insertOne({driver_name: req.body.driver_name, status : "idle", driver_rating : "3", driver_car : car}, function(err, result) {
         if(err){
            console.log(err);
            res.send("Registration unsuccessful! Sorry.. Please try again!");
         }
         else {
            res_result.driver_id = result["ops"][0]["_id"];
            console.log("Registration Process Done for rider: " + req.body.driver_name + " - id: " + result["ops"][0]["_id"]);
            res.send(JSON.stringify(res_result, null, 3));
         }
      });
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

   app.get('/v1/getTotalNumReqs', function (req, res) {
      num_reqs = contractInstance.getNumRequests();
      res.send('Toral Requests: ' + num_reqs);
   })

   /*
   app.post('/api/v1/createNewRequest', function (req, res) {
      console.log("Creating brand new request!");

      contractInstance.createNewRequest.sendTransaction(req.body.request_id, req.body.rider_id, req.body.source, req.body.destination, {gas:max_gas_allowed});

      res.send('New Request Created');
   })   
  */

  /*
   app.post('/api/v1/addQuotation', function (req, res) {
      console.log("Creating quotation for request");

      contractInstance.addQuotation.sendTransaction(req.body.request_id, req.body.quotation_id, req.body.driver_id, req.body.quotation_amount, {gas:max_gas_allowed});

      res.send('Created a quotation!');
   })
  */

  //param: request_id

   app.get('/api/v1/getAllQuotationDetails', function (req, res) {
      console.log("Getting all quotation details of a request");

      result = [];
      console.log(req);
      console.log(req.query.request_id);

      p1 = String(req.query.request_id);
      quotation_map_ids = contractInstance.getAllQuotations(p1);
      //quotation_map_ids = contractInstance.getAllQuotations(req.query.request_id);

      for (var i in quotation_map_ids) {

        p2 = String(quotation_map_ids[i]);
        temp = contractInstance.getQuotationDetails(p1, p2);

        //temp = contractInstance.getQuotationDetails(req.query.request_id, quotation_map_ids[i]);

        temp[0] = web3.toAscii(temp[0]);
        temp[1] = web3.toAscii(temp[1]);

        json_temp = {
            'Quatation ID' : String(web3.toAscii(temp[0])).replace(/\0/g, ''),
            'Driver ID' : String(web3.toAscii(temp[1])).replace(/\0/g, ''),
            'Amount':temp[2]
        }
        result.push(json_temp);
      }

      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(result, null, 3));
   })

    app.get('/api/v1/getReqDetails', function (req, res) {
      console.log("Getting all request details of a request");

      result = {};

      p1 = String(req.query.request_id);
      req_det = contractInstance.getReqDetails(p1);

      console.log(p1);
      console.log(req_det);

      result.rider_id = String(web3.toAscii(req_det[0])).replace(/\0/g, '');
     
      result.src_lat = Number(web3.toAscii(req_det[1]).replace(/\0/g, '').replace("/","-").replace("@","."));
      result.src_lon = Number(web3.toAscii(req_det[2]).replace(/\0/g, '').replace("/","-").replace("@","."));
      result.des_lat = Number(web3.toAscii(req_det[3]).replace(/\0/g, '').replace("/","-").replace("@","."));
      result.des_lon = Number(web3.toAscii(req_det[4]).replace(/\0/g, '').replace("/","-").replace("@","."));


      //result.src_lat = web3.toAscii(req_det[1].replace("/","-").replace());
      //result.src_lon = web3.toAscii(req_det[2].replace("/","-").replace());
      //result.des_lat = web3.toAscii(req_det[3].replace("/","-").replace());
      //result.des_lon = web3.toAscii(req_det[4].replace("/","-").replace());
      result.final_quotation_id = String(web3.toAscii(req_det[5])).replace(/\0/g, '');

      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(result, null, 3));
   })

   var server = app.listen(8081, function () {

      var host = server.address().address
      var port = server.address().port

      console.log("Booking test app listening at http://%s:%s", host, port)
   })

});