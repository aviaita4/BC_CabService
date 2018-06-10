Web3 = require('web3');
web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

var fs = require('fs');
var express = require('express');
var app = express();
var bodyParser  = require('body-parser');
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


   // This responds with "Hello World" on the homepage
   app.get('/', function (req, res) {
      console.log("Got a GET request for the homepage");
      res.send('Hello GET');
   })

   app.get('/getTotalNumReqs', function (req, res) {
      num_reqs = contractInstance.getNumRequests();
      res.send('Toral Requests: ' + num_reqs);
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
   app.post('api/v2/rider/newRequest', function (req, res) {
      console.log("Creating new ride request for : " + req.body.rider_id);

      // Update in Mongo
      // Get request_id
      request_id = 0;


      // Update in Blockchain
      contractInstance.createNewRequest.sendTransaction(request_id, req.body.rider_id, req.body.rider_source, req.body.rider_destination, {gas:max_gas_allowed});

      // Send response

      result = {
         "request_id" : request_id
      }

      res.send(JSON.stringify(result, null, 3));
      console.log("New ride request created: " + request_id + " for rider: " + req.body.rider_id);
   })

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
   app.get('api/v2/rider/pollQuotations', function (req, res) {
      console.log("Polling rides for rider: " + req.query.rider_id + " for the ride: " + req.query.request_id);

      results = [];
      // Get results from Mongo DB

      // Do not neet to do anything in Blockchain
      //contractInstance.createNewRequest.sendTransaction(request_id, req.body.rider_id, req.body.rider_source, req.body.rider_destination, {gas:max_gas_allowed});

      // Send response
      res.send(JSON.stringify(results, null, 3));
      console.log("Polling results are returned successfully for rider: " + req.query.rider_id + " for the ride: " + req.query.request_id);
   })

   // Select final quotation - for a rider for a rider
   /*
   
      Headers: Content-Type : application/json
      Input JSON: rider_id, request_id, final_quotation_id
      Response JSON: 
         
      {
         "booking_status" : "successful" / "unsuccessful"
      }

   */
   app.post('api/v2/rider/selectRide', function (req, res) {
      console.log("Selecting/Finalizing ride(quotation) : " + req.query.final_quotation_id + " for rider: " + req.query.rider_id);

      result = {
         "booking_status" : "unsuccessful";
      }
      // Logic for mongo DB

      // Update result


      // Update final quotation in Blockchain
      if(result.booking_status === "successful"){
         contractInstance.selectQuotation.sendTransaction(req.body.request_id, req.body.final_quotation_id, {gas:max_gas_allowed});   
      }

      // Send response
      res.send(JSON.stringify(result, null, 3));
      console.log("Selection/Finalizing ride(quotation): " + req.query.final_quotation_id + " for the rider: " + req.query.rider_id + " was " + result.booking_status);
   })


   // DRIVER API -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

   // Driver update location
   /*
   
      Headers: Content-Type : application/json
      Input JSON: driver_id, driver_location
      Response JSON: 

      {
         "booking_status" : "successful" / "unsuccessful"
      }

   */
   app.post('api/v2/driver/updateLocation', function (req, res) {
      console.log("Updating driver location for driver : " + req.body.driver_id);

      result = {
         "booking_status" : "unsuccessful"
      }

      // Update in Mongo


      // No updates to Blockchain
      //contractInstance.createNewRequest.sendTransaction(request_id, req.body.rider_id, req.body.rider_source, req.body.rider_destination, {gas:max_gas_allowed});

      // Send response

      res.send(JSON.stringify(result, null, 3));
      console.log("Update location for driver " + req.body.driver_id + " was " + result.booking_status);
   })


   // Poll nearby rides for a rider
   /*
   
      Headers: Content-Type : application/json
      Input JSON: driver_id
      Response JSON: 

      [
         {
            "request_id": "",
            "request_source": "",
            "request_destination": "",
            "request_default_amount": ""
         },
         {
            "request_id": "",
            "request_source": "",
            "request_destination": "",
            "request_default_amount": ""
         }
      ]

   */
   app.get('api/v2/driver/pollRides', function (req, res) {
      console.log("Searching rides for driver: " + req.query.driver_id);

      results = [];
      // Get results from Mongo DB


      // Do not neet to do anything in Blockchain
      //contractInstance.createNewRequest.sendTransaction(request_id, req.body.rider_id, req.body.rider_source, req.body.rider_destination, {gas:max_gas_allowed});

      // Send response
      res.send(JSON.stringify(results, null, 3));
      console.log("Search rides for driver: "+ req.query.driver_id + " done");
   })


   // Add a quotation for a ride - by a driver
   /*
   
      Headers: Content-Type : application/json
      Input JSON: driver_id, request_id, quotation_amount
      Response JSON: 
         
      {
         "quotation_id" : ""
      }

   */
   app.post('api/v2/driver/addQuotation', function (req, res) {
      console.log("Creating quotation for driver : " + req.body.driver_id + " for the ride: " + req.body.request_id);

      result = {
         "quotation_id" : -1;
      }
      // Logic for mongo DB

      // Update result
      quotation_id = -1;

      result.quotation_id = quotation_id

      // Update final quotation in Blockchain
      
      contractInstance.addQuotation.sendTransaction(req.body.request_id, quotation_id, req.body.driver_id, req.body.quotation_amount, {gas:max_gas_allowed});
      

      // Send response
      res.send(JSON.stringify(result, null, 3));
      console.log("Quotatation added :" + quotation_id + " for the ride: " + req.body.request_id + " by " + req.body.driver_id);
   })



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

   app.get('api/v3/price', function (req, res) {
      console.log("Calculating price from: " + req.query.source + " to " + req.query.destination + " with distance: " + req.query.distance);

      price_per_mile = 10

      result = {
         "price" : 0
         "cuurency" : "USD"
      }

      result.price = req.query.distance * price_per_mile;

      res.send(JSON.stringify(result, null, 3));
      
      console.log('Price calculated!');
   })

   // Transparency API ---------------------------------------------------------------------------------------------------------------------------------------------------------------------

   // API v1 -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
   app.post('api/v1/createNewRequest', function (req, res) {
      console.log("Creating brand new request!");

      contractInstance.createNewRequest.sendTransaction(req.body.request_id, req.body.rider_id, req.body.source, req.body.destination, {gas:max_gas_allowed});

      res.send('New Request Created');
   })   

   app.post('api/v1/addQuotation', function (req, res) {
      console.log("Creating quotation for request");

      contractInstance.addQuotation.sendTransaction(req.body.request_id, req.body.quotation_id, req.body.driver_id, req.body.quotation_amount, {gas:max_gas_allowed});

      res.send('Created a quotation!');
   })

   app.get('api/v1/getAllQuotationDetails', function (req, res) {
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




