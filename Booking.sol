pragma solidity ^0.4.18;
// We have to specify what version of compiler this code will compile with

contract Booking {

  struct Booking_request{

    uint8 request_id;
    uint8 rider_id;
    uint8 source;
    uint8 destination;
    uint8 chosen_quotation_id;

    bytes32 quotations_head;
    uint8 num_quotations;

    mapping (bytes32 => Quotation) quotations;
  }

  struct Quotation{

    uint8 quotation_id;
    uint8 driver_id;
    uint8 quotation_amount;

    bytes32 next;
  }

  uint8 public num_booking_requests;
  mapping (uint8 => Booking_request) public booking_requests;

  mapping (uint8 => uint8) public test_mapping;
  

  constructor() public{
    num_booking_requests = 0;
  }

  function getNumRequests() view public returns (uint8){
    return num_booking_requests;
  }

  function createNewRequest(uint8 request_id, uint8 rider_id, uint8 source, uint8 destination) public{
    num_booking_requests++;

    booking_requests[request_id] = Booking_request(request_id, rider_id, source, destination, 0, 0, 0);
  }

  function addQuotation(uint8 request_id, uint8 quotation_id, uint8 driver_id, uint8 quotation_amount) public{

    Booking_request storage br = booking_requests[request_id];
    
    Quotation memory quotation = Quotation(quotation_id, driver_id, quotation_amount, br.quotations_head);

    bytes32 id = sha3(quotation.quotation_id, quotation.driver_id, quotation.quotation_amount);
    br.quotations[id] = quotation;

    br.quotations_head = id;
    br.num_quotations++;
  }

  function getAllQuotations(uint8 request_id) view public returns (bytes32[]){
    
    Booking_request storage br = booking_requests[request_id];
    
    bytes32[] memory quotation_map_ids = new bytes32[](br.num_quotations);
    bytes32 current = br.quotations_head;

    for(uint8 i = 0; i < br.num_quotations; i++){
      quotation_map_ids[i] = current;
      current = br.quotations[current].next;
    }

    return quotation_map_ids;
  }


  function getQuotationDetails(uint8 request_id, bytes32 quotation_map_id) view public returns (uint8, uint8, uint8){
    Booking_request storage br = booking_requests[request_id];
    Quotation memory quotation = br.quotations[quotation_map_id];
    return (quotation.quotation_id, quotation.driver_id, quotation.quotation_amount);
  }


  function selectQuotation(uint8 request_id, uint8 quotation_id) public{
    booking_requests[request_id].chosen_quotation_id = quotation_id;
  }
  
}
