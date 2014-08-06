Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    
    //items:{ html:'<a href="https://help.rallydev.com/apps/2.0rc3/doc/">App SDK 2.0rc3 Docs</a>'},
        launch: function() {
    	//console.log("Rally Confidence Interval App");
        //this._loadData();
        this.pulldownContainer = Ext.create('Ext.container.Container', {    // this container lets us control the layout of the pulldowns; they'll be added below
        id: 'pulldown-container-id',
        layout: {
                type: 'hbox',           // 'horizontal' layout
                align: 'stretch'
            }
      });

      this.add(this.pulldownContainer); // must add the pulldown container to the app to be part of the rendering lifecycle, even though it's empty at the moment

      var projectName = this.getContext().get('project').Name;
      //debug
      console.log('project in context', projectName);  

      //build form
      this._loadButton(projectName);
      this._loadTagPicker(projectName);
      this._loadEndStates();


    },

    //create button
    _loadButton: function(myPrj){
        this.noFilterBtn = Ext.create('Rally.ui.Button', {
            text: 'No Filter',
            handler: function() {
                    //Ext.Msg.alert('Button', 'You clicked me');
                    this._loadData(myPrj);
                },
            scope: this  
        });
        this.pulldownContainer.add(this.noFilterBtn);
    },

    // create tag store and load data
    _loadTagPicker: function(myPrj) {
        this.myTagPicker = Ext.create('Rally.ui.picker.TagPicker', {
            autoexpand: true,
            labelAlign: 'right',
            width: 300,
            fieldLabel: "Filter By Tags: ",
            allowBlank: true,
            //minHeight: 100,
            listeners: {
                ready: function(combobox) {             // on ready: during initialization of the app, once Iterations are loaded, lets go get Defect Severities
                     this._loadEndStates();
               },
                select: function(combobox, records) {   // on select: after the app has fully loaded, when the user 'select's an iteration, lets just relaod the data
                     this._loadData(myPrj);
               },
               scope: this
             } //listen
        });
        this.pulldownContainer.add(this.myTagPicker);
    },

    // create defect severity pulldown then load data
    _loadEndStates: function() {
        // The data store containing the list of states
        var states = Ext.create('Ext.data.Store', {
            fields: ['name'],
            data : [
                {"name": "Completed"},
                {"name": "Accepted"}
            ]
        });

        this.stateComboBox = Ext.create('Ext.form.ComboBox', {
          fieldLabel: 'End State: ',
          store: states,
          width: 300,
          labelAlign: 'right',
          queryMode: 'local',
          displayField: 'name',
          valueField: 'name',
          listeners: {
            ready: function(combobox) {             // this is the last 'data' pulldown we're loading so both events go to just load the actual defect data
                 this._loadData();
           },
            select: function(combobox, records) {
                 this._loadData();
           },
           scope: this                              // <--- don't for get to pass the 'app' level scope into the combo box so the async event functions can call app-level func's!
         }

        });

        this.pulldownContainer.add(this.stateComboBox);    // add the severity list to the pulldown container so it lays out horiz, not the app!
     },

    //Get data from Rally
    _loadData: function(project) {
        var selectedTagRecords = this.myTagPicker._getRecordValue();              // the _ref is unique, unlike the iteration name that can change; lets query on it instead!
        var selectedStateVal = this.stateComboBox.getValue(); //Record().get('value');   // remember to console log the record to see the raw data and relize what you can pluck out

        //debug
        //console.log('selected tag is ', selectedTagRecords);
        //console.log('selected end state is ', selectedStateVal);
        var filter = [];

        if (selectedTagRecords.length > 0) {

            Ext.Array.each(selectedTagRecords, function(thisTag) {
                var thisTagName = thisTag.get('Name');
                //debug
                //console.log('selected tag is ', thisTagName);
                var thisFilter = {
                    property: 'Tags.Name',
                    operator: 'contains',
                    value: thisTagName
                };
                filter.push(thisFilter);
            });

            
        } //end if

        if (selectedStateVal != null) {

            //debug
            console.log('selected state is ', selectedStateVal);
            var aFilter = {
                property: 'KanbanState',
                operator: '=',
                value: selectedStateVal
            };
            filter.push(aFilter);

            
        } //end if

	   //get stories from Rally that match the criteria
	   var postProcResults = [];
	   var ciResults = [];
	   var ciKey = ['ct', 'ctsp'];

	   var ciCTResults = [];
	   var ciCTSPResults = [];
	   /*filter.push({property: 'KanbanState',
                        operator: '=',
                        value: 'Accepted'});
	   filter.push({property: 'Tags.Name',
                        operator: '=',
                        value: 'HMS'});*/
	   
       var myStore = Ext.create('Rally.data.wsapi.Store', {
			model: 'User Story',
			autoLoad: true,
			//TODO: this store config doesn't work. Need to figure out how to change projects for dev/test
			//storeConfig: {
				/*context: { workspace: 'https://rally1.rallydev.com/slm/webservice/1.40/workspace/343331994',
				project: 'https://rally1.rallydev.com/slm/webservice/1.40/project/18792215608'}*/
			filters: filter,
			//},

			fetch: ['FormattedID', 'Name', 'KanbanState', 'PlanEstimate', 'InProgressDate', 'AcceptedDate', 'Tags']
			/*listeners: {
		        load: function(store, records) {
		            //process records
		            
		        }
			}*/
			
		}); 


		myStore.load({
		    callback: function(records, operation) {
		        if(operation.wasSuccessful()) {
		            //process records
		            postProcResults = this._calcCycleTime(records);
		            ciResults = this._calcConfidenceIntervals(postProcResults, ciKey);
		            //this._loadChart(myStore, ciResults)
		            //debug
					//this._loadGrid(myStore);
                    this._loadTextOutput(ciResults, project);
		        } else {
		        	console.log('Negatory' + operation);
		        }
		    },
		    scope: this

		});

    },
    
    //Iterate over records and calc cycle time
    _calcCycleTime: function(source_data) {
    	 var size_source_data = [];
         var size_total = 0;
         var storyPoints = 0;
         var avgSP = 0;
         var bklgSize = 0;
         var bklgCount = 0;
         var ct_source_data = [];
         var ct_total = 0;
         var avgCT = 0;
         var ctsp_source_data = [];
         var ctsp_total = 0;
         var avgCTSP = 0;
         var data = [];

    	for(var i = source_data.length; i-->0;) {
    		var PlanEst = source_data[i].get('PlanEstimate');
    		var InPrgDate = source_data[i].get('InProgressDate');
    		var AcptDate =  source_data[i].get('AcceptedDate');
    		var storyState = source_data[i].get('KanbanState');

    		if (storyState != 'Accepted'){

    			bklgSize += PlanEst;
    			bklgCount ++;

    		} else {

	    		storyPoints = (typeof PlanEst !== 'undefined' && PlanEst >0) ? PlanEst : 1;
	    		var size_length = size_source_data.push(storyPoints);
	            size_total += size_source_data[size_length-1]; //PlanEst total

	            var cycleDays = workingDaysBetweenDates(InPrgDate, AcptDate);
	            var cycleTime = (typeof cycleDays !== 'undefined' && cycleDays >0) ? cycleDays : 1;
	            var ct_length = ct_source_data.push(cycleTime);
	            ct_total += ct_source_data[ct_length-1]; //cycle time total

	    		//calc story points per day
	    		var ctsp = size_source_data[size_length-1].valueOf()/ct_source_data[ct_length-1].valueOf();
	    		var ctsp_length = ctsp_source_data.push(ctsp);
	    		ctsp_total += ctsp_source_data[ctsp_length-1]; //story points per cycle time total
	    	}


    	};

    	avgSP = size_total/size_length;
    	avgCT = ct_total/ct_length;
    	avgCTSP = ctsp_total/ctsp_length;

    	data.push({
    				sp: size_source_data,
    				ct: ct_source_data,
    				ctsp: ctsp_source_data,
    				asp: avgSP,
    				act: avgCT,
    				actsp: avgCTSP,
    				bkls: bklgSize,
    				bklc: bklgCount
    			});


    	return data;    
    },

    //Iterate over data arrays and calc confidence intervals
    _calcConfidenceIntervals: function(source_data, keys) {
    	var data = [];
		/*Calculate standard deviation of population and use to calc CIs*/
		for(var c = keys.length; c-->0;) {
			var sumVariance = 0;
			switch (keys[c]) {
				case 'ct':
					var t =  source_data[0].ct.length;
			    	var times = source_data[0].ct;
					var meanCT = source_data[0].act;
					var medianCT = median(times);
					var bklgCount = source_data[0].bklc;
                    var msrType = keys[c];
					//debug
		    		//console.log("ct key is " + keys[c]);
					break;
				case 'ctsp':
					var t =  source_data[0].ctsp.length;
			    	var times = source_data[0].ctsp;
					var meanCT = source_data[0].actsp;
					var medianCT = median(times);
					var bklgCount = source_data[0].bkls;
                    var msrType = keys[c];
					//debug
		    		//console.log("ctsp key is " + keys[c]);
					break;
				case 'sp':
					//debug
		    		//console.log("key is " + keys[c]);
					break;
				default:
					//debug
		    		//console.log("In default, key is " + keys[c]);
					break;
			}

			//calc CI given cycle times of completed stories

			for(var i = times.length; i-->0;) {
				var variance = times[i].valueOf()-medianCT;
				var varSqr = Math.pow(variance,2);
				sumVariance += varSqr;
				//debug
	    		//console.log("variance is " + variance);
	    		//console.log("varSqr is " + varSqr);
			};

			var l = sumVariance/t;
			var stdDev = Math.sqrt(l);
			var lowerCT_CI = meanCT - 1.96*stdDev/(Math.sqrt(t));
			var upperCT_CI = meanCT + 1.96*stdDev/(Math.sqrt(t));
			
	    	//Apply to remaining backlog to get derived range of days
	    	
	    	var avgDaysRemainingCount = bklgCount*meanCT;
	    	var daysRemainingCountHigh = bklgCount*upperCT_CI;
	    	var daysRemainingCountLow = bklgCount*lowerCT_CI;


	    	//debug
	    	/*console.log("sumVariance is " + sumVariance);
	    	console.log("l is " + l);
	    	console.log("stdDev is " + stdDev);

	    	console.log("bklgCount is " + bklgCount);
	    	console.log("upperCT_CI is " + upperCT_CI);
	    	//console.log("meanCT is " + meanCT);
	    	console.log("medianCT is " + medianCT);
	    	console.log("lowerCT_CI is " + lowerCT_CI);
	    	console.log("daysRemainingCountHigh is " + daysRemainingCountHigh);
	    	console.log("avgDaysRemainingCount is " + avgDaysRemainingCount);
	    	console.log("daysRemainingCountLow is " + daysRemainingCountLow);*/

	    	data.push({
    				t: times,
    				lct: lowerCT_CI,
    				uct: upperCT_CI,
    				mct: meanCT,
    				bklc: bklgCount,
                    msr: msrType,
                    drc: avgDaysRemainingCount,
                    drh: daysRemainingCountHigh,
                    drl: daysRemainingCountLow
    			});

	    	
	    };

    	return data;
    },

    //Put data into text report
    _loadTextOutput: function(source_data, myPrj) {
        var outputText = "<h1> " + myPrj + "</h1><br>";
        /*Generate msgs for output given msr type*/
        for(var c = source_data.length; c-->0;) {
            var meanCT = source_data[c].mct;
            var bklg = source_data[c].bklc;
            var daysRemaining = source_data[c].drc;
            var daysRemainingH = source_data[c].drh;
            var daysRemainingL = source_data[c].drl;
            switch (source_data[c].msr) {
                case 'ct':
                    
                    var msrType = "<h2> Given " + bklg + " stories remaining in the backlog and the cycle time of " + meanCT + " days per story for stories in the end state specified, there are " + daysRemainingL + " to " + daysRemainingH + " days remaing.</h2>";
                    //debug
                    //console.log("ct key is " + source_data[c].msr); 
                    break;
                case 'ctsp':
                    var msrType = "<h2> Given " + bklg + " stories points remaining in the backlog and the cycle time of " + meanCT + " story points per day for stories in the end state specified, there are " + daysRemainingL + " to " + daysRemainingH + " days remaing.</h2>";
                    //debug
                    //console.log("ctsp key is " + source_data[c].msr);
                    break;
                case 'sp':
                    //debug
                    //console.log("key is " + keys[c]);
                    break;
                default:
                    //debug
                    //console.log("In default, key is " + keys[c]);
                    break;
            }

            //outputText.concat(msrType, " <br> ");
            outputText += msrType + " <br> "
            //debug
            //console.log("msrType is " + msrType);  
        };
        var myTxt = Ext.create('Rally.ui.richtext.RichTextEditorReadOnly', {
         html: outputText
        });
        this.add(myTxt);
    },

 

    //Put data into table and display
    _loadGrid: function(myStoryStore) {
    	//get accepted work
    	   var filter = [];
    	   filter.push({property: 'KanbanState',
                            operator: '=',
                            value: 'Accepted'});
    	var myGrid = Ext.create('Rally.ui.grid.Grid', {
            store: myStoryStore,
            filters: filter,
            columnCfgs: ['FormattedID', 'Name', 'KanbanState', 'PlanEstimate', 'InProgressDate', 'AcceptedDate', 'Tags']
		 });
 
		 this.add(myGrid);
         //console.log("what is this?", this);
    },

    //Put data into chart and display
    _loadChart: function(myStoryStore, source_data) {
    	//get accepted work
    	   var filter = [];
    	   var times = source_data[0].t;
    	   filter.push({property: 'KanbanState',
                            operator: '=',
                            value: 'Accepted'});
    	var myCountChart = Ext.create('Ext.chart.Chart', {
            renderTo: Ext.getBody(),
            width: 400,
            height: 300,
            store: myStoryStore,
            hydrate: ['PlanEstimate'],
            filters: filter,
            axes: [{
            	title: 'Cycle time',
            	type: 'Cycle Time',
            	position: 'bottom',
            	fields: ['times'],
            	minimum: 0,
            	maximim: 30
            },
            {
            	title: 'Story Points',
            	type: 'Numeric',
            	position: 'left',
            	fields: ['PlanEstimate'],
            	minimum: 0,
            	maximim: 30
            }],
            series: [{
            	type: 'line',
            	xField: 'PlanEstimate',
            	yField: 'times'
            },
            {
                type: 'category',
                xField: 'PlanEstimate',
                yField: 'times'
            }]
		 });
 
		 this.add(myCountChart);
         //console.log("what is this?", this);
    },
});
