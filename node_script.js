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

   app.post('/createNewRequest', function (req, res) {
      console.log("Creating brand new request!");

      contractInstance.createNewRequest.sendTransaction(req.body.request_id, req.body.rider_id, req.body.source, req.body.destination, {gas:max_gas_allowed});

      res.send('New Request Created');
   })

   app.post('/addQuotation', function (req, res) {
      console.log("Creating quotation for request");

      contractInstance.addQuotation.sendTransaction(req.body.request_id, req.body.quotation_id, req.body.driver_id, req.body.quotation_amount, {gas:max_gas_allowed});

      res.send('Created a quotation!');
   })

   app.get('/getAllQuotationDetails', function (req, res) {
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




