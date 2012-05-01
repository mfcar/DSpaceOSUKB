// # Visualize Data
//
// Simple script to help visualize data generated by elastic search.

// Firstly we wrap our code in a closure to keep variables local.
(function (context) {

    (function ($) {
        var dateStart = new Date($('input[name=dateStart]').val());
        var dateEnd = new Date($('input[name=dateEnd]').val());

        // ### Chart Maker
        //
        // Create a helper module called chart maker that allows us to specify and
        // draw charts.
        context.ChartMaker = function() {
          var chartMaker = {};
          // A place to store charts to draw later.
          chartMaker.charts = {};

          // A shortcut to the google.visualization.DataTable function.
          chartMaker.chartData = function () {
            return new google.visualization.DataTable();
          };

          // The `addChart` function is used to add chart data to `ChartMaker`.
          // It does two things: Creates a div under the specified parent div
          // to put the chart in and add a new chart to `ChartMaker`'s internal
          // list of charts.
          //
          // `addChart` takes an object (`userConfig`) that should have the
          // following keys.
          //
          // * `entries` {object} The entries we use to create the chart.
          // * `name` {string} A nice name to give the chart so the user can reference it
          // later.
          // * `includeTotal` {boolean} Whether or not to include the total in
          // each row.
          // * `chartData` {object} An instance of ChartMaker.chartData containing the data for
          // the chart being added.
          // * `keyField` {string} The name of the key to use on entries.
          // * `valueField` {string} The name of the value to use on entries.
          // * `parentElement` {string} The parent div to create the chart under
          // * `chartType` {string} The key specifying what type of chart to
          // use from `google.visualization`.
          chartMaker.addChart = function (userConfig) {
            var c = $.extend({
                entries: [],
                name: '',
                includeTotal: false,
                chartData: null,
                dataSection: null,
                keyField: 'term',
                valueField: 'count',
                parentElement: 'aspect_dashboard_ElasticSearchStatsViewer_div_chart_div',
                chartType: 'GeoChart'
            }, userConfig);

            // `dataValue` will eventually become the rows of data in our
            // chart.
            var dataValue = [];
            var total = 0;

            // Cheat with dates / data, and zero-fill the start/end edges, and "hopefully" things work out...
            // Set certainty to our cheat date to false, so it gets a dotted line.
            if (c.chartData.A[0].type == 'date' && isValidDate(dateStart) && c.chartType == 'LineChart') {
                var cheatDateStart = [];
                cheatDateStart.push(dateStart);
                cheatDateStart.push(0);
                if(c.includeTotal) {
                    cheatDateStart.push(total);
                }
                cheatDateStart.push(false);
                dataValue.push(cheatDateStart);
            }

            // For each entry construct a vector to add to push onto
            // `dataValue`.
            $.each(c.entries, function(index, entry) {
              if(c.dataSection != null) {
                  entry = entry[c.dataSection];
              }

              newEntry = [];
              if (c.chartData.A[0].type == 'date') {
                newEntry.push(new Date(entry[c.keyField]));
              } else {
                newEntry.push(entry[c.keyField]);
              }

              newEntry.push(entry[c.valueField]);
              if (c.includeTotal) {
                total += entry[c.valueField];
                newEntry.push(total);
              }

              // Certain data gets a certainty score of true. (solid line)
              if (c.chartData.A[0].type == 'date' && c.chartType=='LineChart') {
                  newEntry.push(true);
              }
              dataValue.push(newEntry);
            });

            //Cheat and zero-fill in the last date. Certainty is false, so dotted line.
            if (c.chartData.A[0].type == 'date' && isValidDate(dateEnd) && c.chartType=='LineChart') {
              var cheatDateEnd = [];
              cheatDateEnd.push(dateEnd);
              cheatDateEnd.push(0);
              if(c.includeTotal) {
                  cheatDateEnd.push(total);
              }
              cheatDateEnd.push(false);
              dataValue.push(cheatDateEnd);
            }

            // Add rows (`dataValue`) to the chartData.
            c.chartData.addRows(dataValue);

            // Add a child element
            var par = $('#' + c.parentElement);
            par.append("<div style='height:280px; width:750px;' " +
                "id='dspaceChart_" + c.name + "'> </div>");
            this.charts[c.name] = {
              chart: new google.visualization[c.chartType](
                document.getElementById("dspaceChart_" + c.name)),
              data: c.chartData,
              options: c.options
            };
          };

          // `drawChart` takes a chart from ChartMaker's internal `charts` array
          // (specified by the `name` parameter) and draws that chart.
          chartMaker.drawChart = function(name, globalOptions) {
            if (typeof globalOptions === 'undefined') {
              globalOptions = {};
            }
            var cobj = this.charts[name];

            // Allow the user to overwrite data with a passed in options.
            var data = cobj.data;
            if ('data' in globalOptions) {
              data = globalOptions.data;
            }

            // Merge the Global Options with the local options for the chart
            var combinedOptions = $.extend(globalOptions, cobj.options);
            // Draw the named chart!
            cobj.chart.draw(data, combinedOptions);
          };

          // `drawAllCharts` simply loops through the defined charts and draws
          // each one.
          chartMaker.drawAllCharts = function (options) {
            for (var name in this.charts) {
              this.drawChart(name, options);
            }
          };
          return chartMaker;
        };
    })(jQuery);

    // ## Now some user level code. . .
    // Load the visualization Library
    google.load('visualization', '1',{'packages':['annotatedtimeline', 'geochart', 'corechart', 'table']});

    // Set the callback for once the visualization library has loaded and make
    // sure the DOM has loaded as well.
    google.setOnLoadCallback(function () {
      jQuery(document).ready(function ($) {
        //Create a ChartMaker instance.
        var chartMaker = new ChartMaker();

        // Get data from elastic that has been dumped on the page.
        var elasticJSON = $.parseJSON($('#aspect_dashboard_ElasticSearchStatsViewer_field_response').val());

        // `function chartDataHelper` creates a chartData object from a few
        // parameters.
        // Required userConfig values: textKey, textValue
        // Optional userConfig values: textTotal, hasCertainty
        function chartDataHelper(userConfig) {
          // Set some defaults, but allow user over-ride
          var c = $.extend({
            type:'string',
            includeTotal : false,
            hasCertainty: false
          }, userConfig);

          // Put data from Elastic response into a ChartData object
          var main_chart_data = chartMaker.chartData();

          main_chart_data.addColumn(c.type, c.textKey);
          main_chart_data.addColumn('number', c.textValue);

          if (c.includeTotal) {
            main_chart_data.addColumn('number', c.textTotal);
          }

          // Add a certainty column for date data.
          if (c.hasCertainty == true) {
            main_chart_data.addColumn({type:'boolean',role:'certainty'}); // certainty col.
          }

          return main_chart_data;
        }

        // Set the title for the charts.
        var options = { title : 'Views per DSpaceObject Type' };

        // ### Start adding charts!
        //
        // Use a helper to do all the work to create the
        // associated charts data tables.
        // There is one parent div chart_div, and we will append child divs for each chart.

        // Add a chart to show total downloads.
        var name = $('input[name=containerName]').val();

        var optionsItemsAdded = {title: 'Number of Items Added: ' + name};
        var rawAdded = $('input[name="gson-itemsAdded"]');
        var addedJSON = $.parseJSON(rawAdded.val());
        if((addedJSON !== null) && $('input[name=reportDepth]').val() == "detail") {
            var chartItemsAdded = chartDataHelper({
                type : 'date',
                textKey : 'Date',
                textValue : 'Added Monthly',
                includeTotal: true,
                textTotal: 'Added Total',
                hasCertainty: true
            });
            chartMaker.addChart({
                entries: addedJSON,
                name: 'itemsAddedMonthly',
                chartData: chartItemsAdded,
                dataSection: 'data',
                keyField: 'yearmo',
                valueField: 'countitem',
                includeTotal: true,
                chartType: 'LineChart',
                options: optionsItemsAdded});

            var chartItemsAddedNoTotal = chartDataHelper({
                type : 'date',
                textKey : 'Date',
                textValue : 'Added Monthly',
                includeTotal: false,
                hasCertainty: true
            });
            chartMaker.addChart({
                entries: addedJSON,
                name: 'itemsAddedMonthlyNoTotal',
                chartData: chartItemsAddedNoTotal,
                dataSection: 'data',
                keyField: 'yearmo',
                valueField: 'countitem',
                includeTotal: false,
                chartType: 'LineChart',
                options: optionsItemsAdded});

            var chartItemsAddedTotalTable = chartDataHelper({
                type : 'date',
                textKey : 'Date',
                textValue : 'Added Monthly',
                includeTotal: true,
                textTotal: 'Added Total',
                hasCertainty: false
            });
            chartMaker.addChart({
                entries: addedJSON,
                name: 'itemsAddedMonthlyTotalTable',
                chartData: chartItemsAddedTotalTable,
                dataSection: 'data',
                keyField: 'yearmo',
                valueField: 'countitem',
                includeTotal: true,
                chartType: 'Table',
                options: optionsItemsAdded});
        }

        var optionsFilesAdded = {title: 'Number of Files Added: ' + name};
        var rawFilesAdded = $('input[name="gson-filesAdded"]');
        var filesAddedJSON = $.parseJSON(rawFilesAdded.val());
        if((filesAddedJSON !== null) && $('input[name=reportDepth]').val() == "detail") {
            var chartFilesAdded = chartDataHelper({
                type : 'date',
                textKey : 'Date',
                textValue : 'Added Monthly',
                includeTotal: true,
                textTotal: 'Added Total',
                hasCertainty:true
            });
            chartMaker.addChart({
                entries: filesAddedJSON,
                name: 'filesAddedMonthly',
                chartData: chartFilesAdded,
                dataSection: 'data',
                keyField: 'yearmo',
                valueField: 'countitem',
                includeTotal: true,
                chartType: 'LineChart',
                options: optionsFilesAdded});

            var chartFilesAddedNoTotal = chartDataHelper({
                type : 'date',
                textKey : 'Date',
                textValue : 'Added Monthly',
                hasCertainty: true
            });
            chartMaker.addChart({
                entries: filesAddedJSON,
                name: 'filesAddedMonthlyNoTotal',
                chartData: chartFilesAddedNoTotal,
                dataSection: 'data',
                keyField: 'yearmo',
                valueField: 'countitem',
                includeTotal: false,
                chartType: 'LineChart',
                options: optionsFilesAdded});

            var chartFilesAddedTotalTable = chartDataHelper({
                type : 'date',
                textKey : 'Date',
                textValue : 'Added Monthly',
                includeTotal: true,
                textTotal: 'Added Total'
            });
            chartMaker.addChart({
                entries: filesAddedJSON,
                name: 'filesAddedMonthlyTotalTable',
                chartData: chartFilesAddedTotalTable,
                dataSection: 'data',
                keyField: 'yearmo',
                valueField: 'countitem',
                includeTotal: true,
                chartType: 'Table',
                options: optionsFilesAdded});
        }

        var optionsDownloads = {title: 'Number of File Downloads: ' + name };
        // Add a chart to show monthly downloads (without the total).
        if ((elasticJSON !== null) && (typeof elasticJSON.facets.monthly_downloads !== 'undefined')) {
            var chartDataNoTotal = chartDataHelper({
                type : 'date',
                textKey : 'Date',
                textValue : 'File Downloads',
                hasCertainty: true
            });
            chartMaker.addChart({
                entries: elasticJSON.facets.monthly_downloads.entries,
                name: 'downloadsMonthly',
                chartData: chartDataNoTotal,
                keyField: 'time',
                chartType: 'LineChart',
                options: optionsDownloads});

            if ($('input[name=reportDepth]').val() == "detail") {
                var chartDataTotal = chartDataHelper({
                    type : 'date',
                    textKey : 'Date',
                    textValue : 'File Downloads',
                    includeTotal: true,
                    textTotal: 'Total Downloads'
                });

                // Table with raw data of # Downloads each month
                chartMaker.addChart({
                    entries: elasticJSON.facets.monthly_downloads.entries,
                    name: 'downloadsMonthlyTable',
                    chartData: chartDataTotal,
                    includeTotal : true,
                    keyField : 'time',
                    options:optionsDownloads,
                    chartType: 'Table'
                });

                // Chart of Downloads with aggregate total
                var chartDataTotal2 = chartDataHelper({
                    type : 'date',
                    textKey : 'Date',
                    textValue : 'File Downloads',
                    includeTotal: true,
                    textTotal: 'Total Downloads',
                    hasCertainty: true
                });
                chartMaker.addChart({
                  entries: elasticJSON.facets.monthly_downloads.entries,
                  name: 'downloadsWithTotal',
                  includeTotal: true,
                  chartData: chartDataTotal2,
                  keyField: 'time',
                  chartType: 'LineChart',
                  options: optionsDownloads});
                }

        }

        // Add a chart to show downloads from various countries.
        if ((elasticJSON !== null) && (typeof elasticJSON.facets.top_countries !== 'undefined')) {
            var chartDataGeo = chartDataHelper({
                type : 'string',
                textKey : 'Country',
                textValue : 'Downloads'
            });
            chartMaker.addChart({
                entries: elasticJSON.facets.top_countries.terms,
                name: 'topCountries',
                chartData: chartDataGeo,
                options: options});

            if ($('input[name=reportDepth]').val() == "detail") {
                chartMaker.addChart({
                    entries: elasticJSON.facets.top_countries.terms,
                    name: 'topCountriesTable',
                    chartData: chartDataGeo,
                    options:options,
                    chartType: 'Table'
                });
            }
        }


        // Add a chart to show downloads from various countries.
        if ((elasticJSON !== null) && typeof elasticJSON.facets.top_US_cities !== 'undefined' && $('input[name=reportDepth]').val() == "detail") {
            var chartDataGeoUS = chartDataHelper({
                type : 'string',
                textKey : 'City',
                textValue : 'Downloads'
            });
            var optionsUS = {region : 'US', displayMode : 'markers', resolution : 'provinces', magnifyingGlass : {enable: true, zoomFactor: 7.5} };
            chartMaker.addChart({
                entries: elasticJSON.facets.top_US_cities.terms,
                name: 'topUSCities',
                chartData: chartDataGeoUS,
                options: optionsUS});
        }

        // Add a pie chart that shows top DSO Types usage.
        /*
        if (typeof elasticJSON.facets.top_types !== 'undefined') {
            var chartDataPie = chartDataHelper('string', 'Type', 'Views', false, '');
            chartMaker.addChart({
                entries: elasticJSON.facets.top_types.terms,
                name: 'topTypes',
                chartData: chartDataPie,
                chartType: 'PieChart',
                options: options});
        }
        */

        // Finally, we draw all of the charts.
        chartMaker.drawAllCharts();

        //Set Titles to Charts that cannot otherwise set titles automatically (geocharts).
        var baseURLStats = $('input[name=baseURLStats]').val();
        var timeRangeString = $('input[name=timeRangeString]').val();

        //TODO these dates are already accessed in different scope/context, its a waste to reexecute
        var fromDateString = $('input[name=dateStart]').val();
        var toDateString = $('input[name=dateEnd]').val();

        if ($('input[name=reportDepth]').val() == "summary") {
            $('<p>'+timeRangeString+' <a href="'+ baseURLStats + '/itemsAdded">For more information.</a></p>').insertBefore('#aspect_dashboard_ElasticSearchStatsViewer_table_itemsAddedGrid');
            $('<p>'+timeRangeString+' <a href="'+ baseURLStats + '/filesAdded">For more information.</a></p>').insertBefore('#aspect_dashboard_ElasticSearchStatsViewer_table_filesInContainer-grid');
            $('<h3>Number of File Downloads for ' + name + '</h3>'+timeRangeString+' <a href="'+ baseURLStats + '/fileDownloads">For more information.</a>').insertBefore('#dspaceChart_downloadsMonthly');
            $('<h3>Countries with most Downloads ' + name + '</h3>'+timeRangeString+' <a href="'+ baseURLStats + '/topCountries">For more information.</a>').insertBefore('#dspaceChart_topCountries');
            $('<p>'+timeRangeString+' <a href="'+ baseURLStats + '/topUSCities">For more information.</a></p>').insertBefore('#dspaceChart_topUSCities');
            $('<p>'+timeRangeString+' <a href="'+ baseURLStats + '/topDownloads">For more information.</a></p>').insertBefore('#aspect_dashboard_ElasticSearchStatsViewer_table_facet-Bitstream');
        }

        var reportName = $('input[name=reportName]').val();

        if ($('input[name=reportDepth]').val() == "detail") {
            var contextPanel = '<div><p><a href="' + baseURLStats + '">Back to Summary Statistics for ' + name + '</a></p><br/>';
            contextPanel += '<a href="#" onclick="window.print(); return false;"><img src="http://www.famfamfam.com/lab/icons/silk/icons/printer.png"/>Print This Report</a><br/>';
            contextPanel += '<a href="' + baseURLStats + '/csv/' + reportName;
            if(fromDateString !== null) {
                contextPanel += '?from=' + fromDateString;
            }
            if(toDateString !== null) {
                if(fromDateString !== null) {
                    contextPanel += '&';
                } else {
                    contextPanel =+ '?';
                }

                contextPanel += 'to=' + toDateString;
            }
            contextPanel += '"><img src="http://www.famfamfam.com/lab/icons/silk/icons/page_excel.png"/>Download Data as .csv</a></div>';
            $(contextPanel).insertAfter('#aspect_dashboard_ElasticSearchStatsViewer_div_chart_div');

        }
      });
    });
})(this);

function isValidDate(d) {
    if ( Object.prototype.toString.call(d) !== "[object Date]" )
        return false;
    return !isNaN(d.getTime());
}
