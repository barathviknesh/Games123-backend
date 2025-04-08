'use strict';
const getTableName = require('./getDataFromCommonConstants'),
    constantJSON = require('./constants/constant'),
    commonConstants = constantJSON.getCommonConstants();
let parsedJSON;

exports.getcancellationData = async function (data, locale, currentBranch, dateFromRequest) {
    console.log('getCancelledNDC data  :::', JSON.stringify(data));
    console.log('getCancelledNDC locale  :::', locale);
    console.log('getCancelledNDC currentBranch  :::', currentBranch);
    /* Reading Table Name from Non prod config JSOn file */
    const tableName = await getTableName.fromConfigJson("itineraryChange", currentBranch);
    /* Reading Table Name from Non prod config JSOn file */
    return new Promise((resolve, reject) => {
        if (!data) {
            console.log("Error occurred. ::: " + data);
            reject(data);
        } else {
            console.log("data from db ::: " + JSON.stringify(data));
            resolve(processDBResponse(data));
        }
    });

    function processDBResponse(data) {
        const responsecount = Object.keys(data.Responses[tableName]).length;
        const arr = data.Responses[tableName];
        const cancellationFee = {

            "isItineraryChangeAllowed": "",
            "cancellationFeeValue": "",
            "cancellationFeeLongDesc": ""
        };

        function SortByID(x, y) {
            const xpr = x.priority.N;
            const ypr = y.priority.N;
            return xpr - ypr;
        }
        arr.sort(SortByID);
        parsedJSON = data;
        if (responsecount > 0) {
            // changes for ECDSM-28144 CaaS fare conditions - Return en_UK response if other locales have no response Starts
            //var matchingIndex = checkAndFindMatchingLocaleIndex(arr, locale);
            let response = arr[0].jsonResponse.S;
            // changes for ECDSM-28144 CaaS fare conditions - Return en_UK response if other locales have no response Ends
            const responseparsed = JSON.parse(response);
            const rootContainerJson = responseparsed.rootContainer;
            let cancellationFeeDetails = rootContainerJson.ChangeFeeDetails;
            if (!Array.isArray(cancellationFeeDetails)) {
                cancellationFeeDetails = [cancellationFeeDetails];
            }
            let matchingLocaleDetails = cancellationFeeDetails.find(item => item.language === locale);
            // changes for ECDSM-28144 CaaS fare conditions - Return en_UK response if other locales have no response Starts
            if (matchingLocaleDetails === undefined) {
                matchingLocaleDetails = cancellationFeeDetails.find((item) => item.language === commonConstants.isoCodeLocaleMap["EN"]);
                console.log("locale doesnt having matching value");
            }
            // changes for ECDSM-28144 CaaS fare conditions - Return en_UK response if other locales have no response Ends
            let isCancellationAllowed = rootContainerJson.isCancellation;
            if (matchingLocaleDetails != undefined) {
                let cancellationFeeValue = matchingLocaleDetails.CancellationFee;
                let cancellationFeeLongDesc = matchingLocaleDetails.CancellationFeeRules;
                //changes for ECDSM-27378 Handling for response when DCR is missing starts
                cancellationFee.isItineraryChangeAllowed = isCancellationAllowed;
                cancellationFee.cancellationFeeValue = cancellationFeeValue;
                cancellationFee.cancellationFeeLongDesc = cancellationFeeLongDesc;
                //changes for ECDSM-27378 Handling for response when DCR is missing ends
                return cancellationFee;
            } else {
                return cancellationFee;
            }
        } else {
            console.log("exiting processJSONResponse with null response");
            return cancellationFee;
        }
    }



    function validateResponseForNewFareFamily(data) {
        try {
            const dbResponseSize = parsedJSON.Responses[tableName].length;
            const dateCheckResponse = dateCheckifEmptyorNot(parsedJSON);
            console.log(dateCheckResponse);
            if (dateCheckResponse === true) {
                for (let count = 0; count < dbResponseSize; count++) {
                    let matchingFareFamilyResponse = findFareFamilyWithinDateRange(count);
                    if (undefined != matchingFareFamilyResponse) {

                        break;
                    }
                }
            }
        }
        catch (err) {
            console.error("Error in getcancellationData validateResponseForNewFareFamily" + err);
        }
    }

    /**
     * Method to check if the response has empty dates or not.
     */

    function dateCheckifEmptyorNot(parsedJSON) {

        let flagCheck = true;
        const responseSize = parsedJSON.Responses[tableName].length;
        for (let loopIndex = 0; loopIndex < responseSize; loopIndex++) {
            let responseItem = parsedJSON.Responses[tableName][loopIndex].jsonResponse.S;
            let datecheckparsedResponse = JSON.parse(responseItem);
            if ((undefined != datecheckparsedResponse.rootContainer.startDate) && (undefined != datecheckparsedResponse.rootContainer.endDate) && (datecheckparsedResponse.rootContainer.startDate !== '') && (datecheckparsedResponse.rootContainer.endDate !== '')) {
                flagCheck = true;
            } else {
                console.log("Exiting getcancellationData dateCheckifEmptyorNot. flagCheck ::: false");
                return false;
            }
        }
        return flagCheck;
    }

    /**
     * Method checks if a particular date is present within 2 dates.
     * @param {*} currentDate 
     * @param {*} currentMonth 
     * @param {*} currentYear 
     * @param {*} startDate 
     * @param {*} endDate 
     * @param {*} count 
     */

    function checkIfDateWithinRange(currentDate, currentMonth, currentYear, startDate, endDate, count) {

        if ((new Date(currentDate, currentMonth, currentYear) <= new Date(endDate.toString().substring(0, 2), endDate.toString().substring(3, 5), endDate.toString().substring(6, endDate.length))) && (new Date(currentDate, currentMonth, currentYear) >= new Date(startDate.toString().substring(0, 2), startDate.toString().substring(3, 5), startDate.toString().substring(6, startDate.length)))) {
            const dateMatchingResponse = parsedJSON.Responses[tableName][count];
            return dateMatchingResponse;
        }
    }
    function findFareFamilyWithinDateRange(count) {

        const finalparsedJSON = parsedJSON.Responses[tableName][count].jsonResponse.S;
        let parsedResponse = JSON.parse(finalparsedJSON);
        let currDate;
        if (undefined !== dateFromRequest) {
            currDate = dateFromRequest;
        }
        else {
            let currMonth = "0" + (dateFromRequest.getMonth() + 1);
            currDate = dateFromRequest.getDate() + "/" + currMonth + "/" + dateFromRequest.getFullYear();
        }
        let startDate;
        if (undefined != parsedResponse.rootContainer.startDate) {
            startDate = parsedResponse.rootContainer.startDate;
        }

        let endDate;
        if (undefined != parsedResponse.rootContainer.endDate) {
            endDate = parsedResponse.rootContainer.endDate;
        }

        if (undefined != currDate) {
            let currentDate = currDate.toString().substring(0, 2);
            let currentMonth = currDate.toString().substring(3, 5);
            let currentYear = currDate.toString().substring(6, currDate.length);
            if (startDate !== '' && endDate !== '') {
                let withinRangeResponse = checkIfDateWithinRange(currentDate, currentMonth, currentYear, startDate, endDate, count);
            }
        }
        return withinRangeResponse;
    }
};

exports.getcancellationDataResponse = function (cancellationFeeArray, locale) {
    let responseJson1;
    let responseJson2;
    let boundResponseJson = [];
    responseJson1 = {
        "beforeDeparture": {
            "description": {
                "plainText": {
                    "longDescription": "",
                    "shortDescription": ""
                }
            }
        }
    };
    responseJson2 = {
        "beforeDeparture": {
            "description": {
                "plainText": {
                    "longDescription": "",
                    "shortDescription": ""
                }
            }
        }
    };
    if (cancellationFeeArray[0].length > 1) {
        let cancellationData = cancellationFeeArray[0];
        for (let currSegData in cancellationData) {
            responseJson1.beforeDeparture.description.plainText.longDescription = cancellationData[currSegData].cancellationFeeLongDesc;
            responseJson1.beforeDeparture.description.plainText.shortDescription = cancellationData[currSegData].cancellationFeeValue;
            boundResponseJson.push(responseJson1);
        }
    } // Handling for round trip restrictive logic
    else if (cancellationFeeArray.length > 1) {
        let boundArray;
        boundArray = applyRestrictiveLogic(cancellationFeeArray, locale);
        responseJson1.beforeDeparture.description.plainText.longDescription = boundArray[0].cancellationFeeLongDesc;
        responseJson1.beforeDeparture.description.plainText.shortDescription = boundArray[0].cancellationFeeValue;
        responseJson2.beforeDeparture.description.plainText.longDescription = boundArray[1].cancellationFeeLongDesc;
        responseJson2.beforeDeparture.description.plainText.shortDescription = boundArray[1].cancellationFeeValue;
        boundResponseJson.push(responseJson1);
        boundResponseJson.push(responseJson2);

    } else { // Handling for only one bound with one segment
        responseJson1.beforeDeparture.description.plainText.longDescription = cancellationFeeArray[0][0].cancellationFeeLongDesc;
        responseJson1.beforeDeparture.description.plainText.shortDescription = cancellationFeeArray[0][0].cancellationFeeValue;
        boundResponseJson.push(responseJson1);
    }
    return boundResponseJson;
};

function applyRestrictiveLogic(cancellationFeeArray, locale) {
    let labels = getTableName.getRestriciveLabel(locale);
    let list = [labels[0], labels[1], labels[2]];
    let regex = /\d+/g;
    let cancellationFeeC1 = "";
    let cancellationFeeC2 = "";
    let cancellationFeeL1 = "";
    let cancellationFeeL2 = "";
    cancellationFeeC1 = cancellationFeeArray[0].cancellationFeeValue;
    cancellationFeeC2 = cancellationFeeArray[1].cancellationFeeValue;
    cancellationFeeL1 = cancellationFeeArray[0].cancellationFeeLongDesc;
    cancellationFeeL2 = cancellationFeeArray[1].cancellationFeeLongDesc;

    // To compare if both text values
    if (!(/\d/.test(cancellationFeeC1)) && !(/\d/.test(cancellationFeeC2))) {
        if (list.includes(cancellationFeeC1) && list.includes(cancellationFeeC2)) {
            if (list.indexOf(cancellationFeeC1) < list.indexOf(cancellationFeeC2)) {
                cancellationFeeC2 = cancellationFeeC1;
                cancellationFeeL2 = cancellationFeeL1;
            } else if (list.indexOf(cancellationFeeC2) < list.indexOf(cancellationFeeC1)) {
                cancellationFeeC1 = cancellationFeeC2;
                cancellationFeeL1 = cancellationFeeL2;
            }
        }
    }
    // To compare if both numeric values
    else if ((/\d/.test(cancellationFeeC1)) && (/\d/.test(cancellationFeeC2))) {
        let c1 = parseInt(cancellationFeeC1.match(regex), 10);
        let c2 = parseInt(cancellationFeeC2.match(regex), 10);
        if (c1 > c2) {
            cancellationFeeC2 = cancellationFeeC1;
            cancellationFeeL2 = cancellationFeeL1;
        } else if (c2 > c1) {
            cancellationFeeC1 = cancellationFeeC2;
            cancellationFeeL1 = cancellationFeeL2;
        }
    }
    // To compare if one numeric and one text values
    else {
        if (cancellationFeeC1 == labels[0] && (/\d/.test(cancellationFeeC2))) {
            cancellationFeeC2 = labels[0];
            cancellationFeeL2 = cancellationFeeL1;
        } else if (cancellationFeeC2 == labels[0] && (/\d/.test(cancellationFeeC1))) {
            cancellationFeeC1 = labels[0];
            cancellationFeeL1 = cancellationFeeL2;
        } else if (cancellationFeeC1 == labels[2] && (/\d/.test(cancellationFeeC2))) {
            cancellationFeeC1 = cancellationFeeC2;
            cancellationFeeL1 = cancellationFeeL2;
        } else if (cancellationFeeC2 == labels[2] && (/\d/.test(cancellationFeeC1))) {
            cancellationFeeC2 = cancellationFeeC1;
            cancellationFeeL2 = cancellationFeeL1;
        }
    }
    cancellationFeeArray[0].cancellationFeeValue = cancellationFeeC1;
    cancellationFeeArray[1].cancellationFeeValue = cancellationFeeC2;
    cancellationFeeArray[0].cancellationFeeLongDesc = cancellationFeeL1;
    cancellationFeeArray[1].cancellationFeeLongDesc = cancellationFeeL2;
    return cancellationFeeArray;
}

function checkAndFindMatchingLocaleIndex(dbResponseArray, locale) {
    let matchingIndex = undefined;
    let currentIndex = 0;
    dbResponseArray.forEach(currentRecord => {
        let currRecJsonRes = JSON.parse(currentRecord.jsonResponse.S);
        currRecJsonRes = currRecJsonRes.rootContainer.ChangeFeeDetails;
        if (!Array.isArray(currRecJsonRes)) {
            currRecJsonRes = [currRecJsonRes];
        }
        let matchingLocaleRes = currRecJsonRes.find(item => item.language === locale);
        if (matchingLocaleRes != undefined && matchingIndex == undefined) {
            matchingIndex = currentIndex;
        }
        currentIndex++;
    });
    return matchingIndex;
}