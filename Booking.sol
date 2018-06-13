pragma solidity ^0.4.18;
// We have to specify what version of compiler this code will compile with

contract Booking {

  struct Booking_request{

    bytes32 request_id;
    bytes32 rider_id;
    bytes32 source_lat;
    bytes32 source_lon;
    bytes32 destination_lat;
    bytes32 destination_lon;

    bytes32 chosen_quotation_id;

    bytes32 quotations_head;
    uint8 num_quotations;

    mapping (bytes32 => Quotation) quotations;
  }

  struct Quotation{

    bytes32 quotation_id;
    bytes32 driver_id;
    uint8 quotation_amount;

    bytes32 next;
  }

  uint8 public num_booking_requests;
  mapping (bytes32 => Booking_request) public booking_requests;  

  constructor() public{
    num_booking_requests = 0;
  }

  // STORAGE API ----------------------------------------------------------------------------------------------------------

  function createNewRequest(bytes32 request_id, bytes32 rider_id, bytes32 source_lat, bytes32 source_lon, bytes32 destination_lat, bytes32 destination_lon) public{
    num_booking_requests++;

    booking_requests[request_id] = Booking_request(request_id, rider_id, source_lat, source_lon, destination_lat, destination_lon, 0, 0, 0);
  }

  function addQuotation(bytes32 request_id, bytes32 quotation_id, bytes32 driver_id, uint8 quotation_amount) public{

    Booking_request storage br = booking_requests[request_id];
    
    Quotation memory quotation = Quotation(quotation_id, driver_id, quotation_amount, br.quotations_head);

    bytes32 id = sha3(quotation.quotation_id, quotation.driver_id, quotation.quotation_amount);
    br.quotations[id] = quotation;

    br.quotations_head = id;
    br.num_quotations++;
  }

  function selectQuotation(bytes32 request_id, bytes32 quotation_id) public{
    booking_requests[request_id].chosen_quotation_id = quotation_id;
  }

  // TRANSPARENCY API ----------------------------------------------------------------------------------------------------------

  function getNumRequests() view public returns (uint8){
    return num_booking_requests;
  }

  function getReqDetails(bytes32 request_id) view public returns (bytes32, bytes32, bytes32, bytes32, bytes32, bytes32){

    Booking_request storage br = booking_requests[request_id];
    return(br.rider_id, br.source_lat, br.source_lon, br.destination_lat, br.destination_lon, br.chosen_quotation_id);

  }

  function getAllQuotations(bytes32 request_id) view public returns (bytes32[]){
    
    Booking_request storage br = booking_requests[request_id];
    
    bytes32[] memory quotation_map_ids = new bytes32[](br.num_quotations);
    bytes32 current = br.quotations_head;

    for(uint8 i = 0; i < br.num_quotations; i++){
      quotation_map_ids[i] = current;
      current = br.quotations[current].next;
    }

    return quotation_map_ids;
  }

  function getQuotationDetails(bytes32 request_id, bytes32 quotation_map_id) view public returns (bytes32, bytes32, uint8){
    Booking_request storage br = booking_requests[request_id];
    Quotation memory quotation = br.quotations[quotation_map_id];
    return (quotation.quotation_id, quotation.driver_id, quotation.quotation_amount);
  }
  
}
