Web3 = require('web3');
web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

var fs = require('fs');
var express = require('express');
var app = express();

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
contractInstance = BookingContract.at(deployedContract.address);


// This responds with "Hello World" on the homepage
app.get('/', function (req, res) {
   console.log("Got a GET request for the homepage");
   res.send('Hello GET');
})

app.post('/createNewRequest', function (req, res) {
   console.log("Creating brand new request!");

   //console.log(req.route.stack);

   contractInstance.createNewRequest(req.headers['request_id'], req.headers['rider_id'], req.headers['source'], req.headers['destination']);

   //contractInstance.createNewRequest(1, 10, 12345, 54321);

   res.send('New Request Created');
})

app.post('/addQuotation', function (req, res) {
   console.log("Creating quotation for request");

   contractInstance.addQuotation(req.param('request_id'), req.param('quotation_id'), req.param('driver_id'), req.param('uint quotation_amount'));

   res.send('Created a quotation!');
})


app.get('/list_', function (req, res) {
   console.log("Got a GET request for /list_user");
   res.send('Page Listing');
})


var server = app.listen(8081, function () {

   var host = server.address().address
   var port = server.address().port

   console.log("Booking test app listening at http://%s:%s", host, port)
})



