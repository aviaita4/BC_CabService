pragma solidity ^0.4.18;
// We have to specify what version of compiler this code will compile with

contract Booking {

  struct Booking_request{

    uint request_id;
    uint rider_id;
    uint source;
    uint destination;
    uint chosen_quotation_id;

    bytes32 quotations_head;
    uint num_quotations;

    mapping (bytes32 => Quotation) quotations;
  }

  struct Quotation{

    uint quotation_id;
    uint driver_id;
    uint quotation_amount;

    bytes32 next;
  }

  uint num_booking_requests;
  mapping (uint => Booking_request) booking_requests;

  function Booking(){}

  function createNewRequest(uint request_id, uint rider_id, uint source, uint destination) public{

    num_booking_requests++;

    Booking_request memory br = Booking_request(request_id, rider_id, source, destination, 0, 0, 0);
    
    /*
    br.request_id = request_id;
    br.rider_id = rider_id;
    br.source = source;
    br.destination = destination;

    br.chosen_quotation_id = 0;
    br.num_quotations = 0;
    */

    booking_requests[request_id] = br;
  }

  function addQuotation(uint request_id, uint quotation_id, uint driver_id, uint quotation_amount) public{

    Booking_request storage br = booking_requests[request_id];
    
    Quotation memory quotation = Quotation(quotation_id, driver_id, quotation_amount, br.quotations_head);
    
    /*
    quotation.next = br.quotations_head;

    quotation.quotation_id = quotation_id;
    quotation.driver_id = driver_id;
    quotation.quotation_amount = quotation_amount;
    */


    bytes32 id = sha3(quotation.quotation_id, quotation.driver_id, quotation.quotation_amount);
    br.quotations[id] = quotation;

    br.quotations_head = id;
    br.num_quotations++;
  }

  function getAllQuotations(uint request_id) public returns (bytes32[]){
    
    Booking_request storage br = booking_requests[request_id];
    
    bytes32[] memory quotation_map_ids = new bytes32[](br.num_quotations);
    bytes32 current = br.quotations_head;

    for(uint i = 0; i < br.num_quotations; i++){
      quotation_map_ids[i] = current;
      current = br.quotations[current].next;
    }

    return quotation_map_ids;
  }

  function getQuotationDetails(uint request_id, bytes32 quotation_map_id) public returns (uint, uint, uint){
    Booking_request storage br = booking_requests[request_id];
    Quotation memory quotation = br.quotations[quotation_map_id];
    return (quotation.quotation_id, quotation.driver_id, quotation.quotation_amount);
  }

  function selectQuotation(uint request_id, uint quotation_id) public{
    booking_requests[request_id].chosen_quotation_id = quotation_id;
  }
  
}
