'use strict';
const getTableName = require('./getDataFromCommonConstants'),
   constantConfigJson = require('./constants/constant'),
   commonConstants = constantConfigJson.getCommonConstants();

exports.getNoshowData = async function (data, locale, currentBranch, dateFromRequest) {
    console.log('noshowNDC data :::',JSON.stringify(data));
    console.log('noshowNDC locale :::',JSON.stringify(locale));
    console.log('noshowNDC currentBranch :::',JSON.stringify(currentBranch));
    let parsedJSON;
    /* Reading Table Name from Non prod config JSOn file */
    const tableName = await getTableName.fromConfigJson("noShow", currentBranch);
    /* Reading Table Name from Non prod config JSOn file */

    return new Promise((resolve, reject) => {
        if (!data) {
            console.log("Error occurred. ::: " + data);
            reject(data);
        } else {
            console.log("Success. resolving getNoshowData");
            resolve(processResponse(data));
        }
    });

    function processResponse(data) {
        const responsecount = Object.keys(data.Responses[tableName]).length;
        const arr = data.Responses[tableName];
        const noshowFee = {

            "isItineraryChangeAllowed": "",
            "noshowFeeValue": "",
            "noshowFeeLongDesc": ""
        };
		
        function SortByID(x, y) {
            const xpr = x.priority.N;
            const ypr = y.priority.N;
            return xpr - ypr;
        }
        arr.sort(SortByID);
        parsedJSON = data;
        console.log("Before checking getNoshowData new FF");
        //validateResponseForNewFareFamily(data);
        console.log("After checking getNoshowData new FF");
        if (responsecount > 0) {
            // changes for ECDSM-28144 CaaS fare conditions - Return en_UK response if other locales have no response Starts
            //var matchingIndex = checkAndFindMatchingLocaleIndex(arr, locale);
            let response = arr[0].jsonResponse.S;
            // changes for ECDSM-28144 CaaS fare conditions - Return en_UK response if other locales have no response Ends
            const responseparsed = JSON.parse(response);
            const rootContainerJson = responseparsed.rootContainer;
            let noshowFeeDetails = rootContainerJson.ChangeFeeDetails;
            if (!Array.isArray(noshowFeeDetails)) {
                noshowFeeDetails = [noshowFeeDetails];
            }
            let matchingLocaleDetails = noshowFeeDetails.find(item => item.language === locale);
            // changes for ECDSM-28144 CaaS fare conditions - Return en_UK response if other locales have no response Starts
            if (matchingLocaleDetails === undefined) {
                matchingLocaleDetails = noshowFeeDetails.find((item) => item.language === commonConstants.isoCodeLocaleMap["EN"]);
                console.log("locale doesnt having matching value");
            }
            // changes for ECDSM-28144 CaaS fare conditions - Return en_UK response if other locales have no response Ends
            if (matchingLocaleDetails != undefined) {
                let isNoshowAllowed = rootContainerJson.isNoshow;
                let noshowFeeValue = matchingLocaleDetails.NoShowFee;
                let noshowFeeLongDesc = matchingLocaleDetails.NoShowFeesRules;
                //changes for ECDSM-27378 Handling for response when DCR is missing starts
                noshowFee.isItineraryChangeAllowed = isNoshowAllowed;
                noshowFee.noshowFeeValue = noshowFeeValue;
                noshowFee.noshowFeeLongDesc = noshowFeeLongDesc;
                //changes for ECDSM-27378 Handling for response when DCR is missing ends
                return noshowFee;
            } else {
                return noshowFee;
            }
        } else {
            return noshowFee;
        }
    }


    function validateResponseForNewFareFamily(data) {

        try {

            console.log("getNoshowData Stringified data ::::" + JSON.stringify(parsedJSON));
            const dbResponseSize = parsedJSON.Responses[tableName].length;

            const dateCheckResponse = dateCheckifEmptyorNot(parsedJSON);

            if (dateCheckResponse === true) {
                for (let count = 0; count < dbResponseSize; count++) {
                    let matchingFareFamilyResponse = findFareFamilyWithinDateRange(count);
                    if (undefined != matchingFareFamilyResponse) {
                        console.log("getNoshowData matchingFareFamilyResponse:::: " + JSON.stringify(matchingFareFamilyResponse));
                        break;
                    }
                }
                let finalFareFamilyResponse = formUpdatedFareFamilyResponse(matchingFareFamilyResponse);


            } else {
                console.log("getNoshowData dateCheckResponse is false :: " + JSON.stringify(parsedJSON));
            }
            console.log("Exiting getNoshowData if validateResponseForNewFareFamily");
        }
        catch (err) {
            console.error("Error in getNoshowData validateResponseForNewFareFamily" + err);
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
                console.log("Exiting getNoshowData dateCheckifEmptyorNot. flagCheck ::: false");
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
        else {
            console.log("getNoshowData Datecheck failed");
        }
        console.log("Exiting getNoshowData checkIfDateWithinRange");
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
            else {
                console.log("getNoshowData date validation check failed");
            }

        }
        console.log("Exiting getNoshowData findFareFamilyWithinDateRange ::::" + withinRangeResponse);
        return withinRangeResponse;
    }
    function formUpdatedFareFamilyResponse(resultantValue) {

        //var parser = JSON.parse(resultantValue)
        let resultJSON = {
            "Responses": {
                [tableName]: resultantValue
            },
            "UnprocessedKeys": {}

        };

        return resultJSON;
    }
};
exports.getnoshowDataResponse = function (noshowFeeArray, locale) {
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
    if (noshowFeeArray[0].length > 1) {
        let noShowFeeData = noshowFeeArray[0];
        for (let currSegData in noShowFeeData) {
            responseJson1.beforeDeparture.description.plainText.longDescription = noShowFeeData[currSegData].noshowFeeLongDesc;
            responseJson1.beforeDeparture.description.plainText.shortDescription = noShowFeeData[currSegData].noshowFeeValue;
            boundResponseJson.push(responseJson1);
        }
    } else if (noshowFeeArray.length > 1) {
        let boundArray;
        boundArray = applyRestrictiveLogic(noshowFeeArray, locale);
        responseJson1.beforeDeparture.description.plainText.longDescription = boundArray[0].noshowFeeLongDesc;
        responseJson1.beforeDeparture.description.plainText.shortDescription = boundArray[0].noshowFeeValue;
        responseJson2.beforeDeparture.description.plainText.longDescription = boundArray[1].noshowFeeLongDesc;
        responseJson2.beforeDeparture.description.plainText.shortDescription = boundArray[1].noshowFeeValue;
        boundResponseJson.push(responseJson1);
        boundResponseJson.push(responseJson2);


    } else {
        responseJson1.beforeDeparture.description.plainText.longDescription = noshowFeeArray[0][0].noshowFeeLongDesc;
        responseJson1.beforeDeparture.description.plainText.shortDescription = noshowFeeArray[0][0].noshowFeeValue;
        boundResponseJson.push(responseJson1);
    }
    return boundResponseJson;
};

function applyRestrictiveLogic(noshowFeeArray, locale) {
    let regex = /\d+/g;
    //var list = ["Not Allowed", "Exceptions Apply", "Complimentary"];
    let labels = getTableName.getRestriciveLabel(locale);
    let list = [labels[0], labels[1], labels[2]];
    let noshowFeeC1 = "";
    let noshowFeeC2 = "";
    let noshowFeeL1 = "";
    let noshowFeeL2 = "";
    noshowFeeC1 = noshowFeeArray[0].noshowFeeValue;
    noshowFeeC2 = noshowFeeArray[1].noshowFeeValue;
    noshowFeeL1 = noshowFeeArray[0].noshowFeeLongDesc;
    noshowFeeL2 = noshowFeeArray[1].noshowFeeLongDesc;
    // To compare if both change fee values same
    // To compare if both text values
    if (!(/\d/.test(noshowFeeC1)) && !(/\d/.test(noshowFeeC2))) {
        if (list.includes(noshowFeeC1) && list.includes(noshowFeeC2)) {
            if (list.indexOf(noshowFeeC1) < list.indexOf(noshowFeeC2)) {
                noshowFeeC2 = noshowFeeC1;
                noshowFeeL2 = noshowFeeL1;
            } else if (list.indexOf(noshowFeeC2) < list.indexOf(noshowFeeC1)) {
                noshowFeeC1 = noshowFeeC2;
                noshowFeeL1 = noshowFeeL2;
            }
        }
    }
    // To compare if both numeric values
    else if ((/\d/.test(noshowFeeC1)) && (/\d/.test(noshowFeeC2))) {
        let c1 = parseInt(noshowFeeC1.match(regex), 10);
        let c2 = parseInt(noshowFeeC2.match(regex), 10);
        if (c1 > c2) {
            noshowFeeC2 = noshowFeeC1;
            noshowFeeL2 = noshowFeeL1;
        } else if (c2 > c1) {
            noshowFeeC1 = noshowFeeC2;
            noshowFeeL1 = noshowFeeL2;
        }
    }

    // To compare if one numeric and one text values
    else {
        if (noshowFeeC1 == labels[0] && (/\d/.test(noshowFeeC2))) {
            noshowFeeC2 = labels[0];
            noshowFeeL2 = noshowFeeL1;
        } else if (noshowFeeC2 == labels[0] && (/\d/.test(noshowFeeC1))) {
            noshowFeeC1 = labels[0];
            noshowFeeL1 = noshowFeeL2;
        } else if (noshowFeeC1 == labels[2] && (/\d/.test(noshowFeeC2))) {
            noshowFeeC1 = noshowFeeC2;
            noshowFeeL1 = noshowFeeL2;
        } else if (noshowFeeC2 == labels[2] && (/\d/.test(noshowFeeC1))) {
            noshowFeeC2 = noshowFeeC1;
            noshowFeeL2 = noshowFeeL1;
        }
    }
    noshowFeeArray[0].noshowFeeValue = noshowFeeC1;
    noshowFeeArray[1].noshowFeeValue = noshowFeeC2;
    noshowFeeArray[0].noshowFeeLongDesc = noshowFeeL1;
    noshowFeeArray[1].noshowFeeLongDesc = noshowFeeL2;
    return noshowFeeArray;
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