var holidays = [
     '01/01/2010',  // New Years
     '01/18/2010',  // Martin Luther King, Jr.
     '02/15/2010'   // President's
  ]

  // Finds the index of the first occurence of item in the array, or -1 if not found
  if ( typeof Array.prototype.indexOf == "undefined" ) {
    Array.prototype.indexOf = function( value ) {
      for ( var i = 0; i < this.length; i++ ) {
        if ( ( typeof this[ i ] == typeof value ) && ( this[ i ] == value ) ) {
          return i;
        }
      }
      return -1;
    }
  }

  function fmtDate( when ) {
    function D2( val ) {
      return ( val < 10 ) ? '0' + val : '' + val;
    }
    return D2( when.getMonth() + 1 ) + '/' + D2( when.getDate() ) + '/' + when.getFullYear();
  }

  function workdays( d1, d2 ) { 
    var result = 0; 
    var d0 = new Date();
    var negative = 1;
    if ( ( typeof( d1 ) == typeof( d2 ) ) && ( typeof( d1 ) == typeof( d0 ) ) ) { 
      if ( d2 < d1 ) {  // Exchange/swap the dates 
        d0 = d2; 
        d2 = d1; 
        d1 = d0; 
        negative = -1;
      } 
      for ( d = d1; d < d2; d.setDate( d.getDate() + 1 ) ) { 
       dow = d.getDay();     // Day Of Week: 0 (Sun) .. 6 (Sat)
       when = fmtDate( d );  // Formatted date
       if ( ( dow > 0 ) && ( dow < 6 ) && ( holidays.indexOf( when ) == -1 ) ) { 
          result++; 
        } 
      } 
    } else { 
      alert( 'workdays() - parameter error - date objects required.' ); 
    } 
    return result 
  } 