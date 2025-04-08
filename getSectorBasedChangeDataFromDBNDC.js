'use strict';
let AWS = require('aws-sdk'),
    getTableName = require('./getDataFromCommonConstants'),
    ddb = new AWS.DynamoDB(),
    parsedJSON,
    tableName = "",
    cutOverDate,
    fFSwitch;
const constantJSON = require('./constants/constant'),
    commonConstants = constantJSON.getCommonConstants(),
    logger = require('./logging/logger'); 
const Utils = require('./utils');

exports.getSectorChangeData = async function (fareFamilyType, origin, destination, rbd, countyCodeList, currentBranch, dateFromRequest, cutOverDateFromDb, newFFSwitch, itcFFCodes) {
    cutOverDate = cutOverDateFromDb;
    fFSwitch = newFFSwitch;
    let check = newFFSwitch.toUpperCase() == "TRUE" && Utils.checkForNewFFConditions(fareFamilyType, dateFromRequest,itcFFCodes);
    tableName = await getTableName.fromConfigJson("itineraryChange", currentBranch);
    let countryCode = countyCodeList, originCountryCode = countryCode[0].countrycode, destinationCountryCode = countryCode[1].countrycode;

   
    let params =  Utils.getInitialValues(check, rbd, origin, destination, originCountryCode, destinationCountryCode, fareFamilyType, tableName);
 
    logger.info("getSectorChangeData params ::: " + JSON.stringify(params));
    return new Promise((resolve, reject) => {
        ddb.batchGetItem(params, function (err, data) {
            if (err) {
                console.log("Rejecting promise ::: " + err);
                reject(err);
            } else {
                console.log("Resolving promise getSectorChangeData::: " + JSON.stringify(data));
                resolve(data);
            }
        });
    });

};

exports.processSectorJsonForChangeItinerary = function (data, locale, dateFromRequest) {
    let arr = data.Responses[tableName];
    arr.sort(Utils.SortByID);
    parsedJSON = data;
    if (fFSwitch.toUpperCase() == "TRUE") {
        parsedJSON = validateResponseForNewFareFamily(data);
    }

    console.log("After checking getSectorChangeData new FF" + JSON.stringify(parsedJSON));
    let responsecount = Object.keys(parsedJSON.Responses[tableName]).length;
    let sectorValue = {
        "beforeDeparture": {
            "description": {
                "plainText": {
                    "longDescription": "",
                    "shortDescription": ""
                }
            }
        }
    };

    if (responsecount > 0) {
        // changes for ECDSM-28144 CaaS fare conditions - Return en_UK response if other locales have no response Starts
        let response = arr[0].jsonResponse.S;
        // changes for ECDSM-28144 CaaS fare conditions - Return en_UK response if other locales have no response Ends
        let responseparsed = JSON.parse(response);
        let rootContainerJson = responseparsed.rootContainer;
        let changeFeeDetails = rootContainerJson.ChangeFeeDetails;
        if (!Array.isArray(changeFeeDetails)) {
            changeFeeDetails = [changeFeeDetails];
        }
        let matchingLocaleDetails = changeFeeDetails.find(item => item.language === locale);
        // changes for ECDSM-28144 CaaS fare conditions - Return en_UK response if other locales have no response Starts
        if (matchingLocaleDetails === undefined) {
            matchingLocaleDetails = changeFeeDetails.find((item) => item.language === commonConstants.isoCodeLocaleMap["EN"]);
            console.log("locale doesnt having matching value");
        }
        // changes for ECDSM-28144 CaaS fare conditions - Return en_UK response if other locales have no response Ends
        if (matchingLocaleDetails != undefined) {
            let changeFeeValue = matchingLocaleDetails.ChangeFee;
            let changeFeeLongDesc = matchingLocaleDetails.changeFeeRules;
            sectorValue.beforeDeparture.description.plainText.longDescription = changeFeeLongDesc;
            sectorValue.beforeDeparture.description.plainText.shortDescription = changeFeeValue;
        }
		//changes for ECDSM-27378 Handling for response when DCR is missing starts
        else {
            return sectorValue;
        }
        //changes for ECDSM-27378 Handling for response when DCR is missing ends
    }
    return sectorValue;

    function validateResponseForNewFareFamily(data) {
        let matchingFareFamilyResponse;
        let finalFareFamilyResponse;
        try {
            let dbResponseSize = parsedJSON.Responses[tableName].length;
            let dateCheckResponse = Utils.dateCheckifEmptyorNot(parsedJSON);
            if (dateCheckResponse === true) {
                for (let count = 0; count < dbResponseSize; count++) {
                    matchingFareFamilyResponse = Utils.findFareFamilyWithinDateRange(count);
                    if (undefined != matchingFareFamilyResponse) {
                        console.log("getSectorChangeData matchingFareFamilyResponse:::: " + JSON.stringify(matchingFareFamilyResponse));
                        break;
                    }
                }
                if (matchingFareFamilyResponse != undefined) {
                    finalFareFamilyResponse = formUpdatedFareFamilyResponse(matchingFareFamilyResponse);
                } else {
                    console.log("matchingFareFamilyResponse is undefined.");
                    return data;
                }
                console.log("getSectorChangeData Final response ::: " + JSON.stringify(finalFareFamilyResponse));

            } else {
                console.log("getSectorChangeData dateCheckResponse is false :: " + JSON.stringify(parsedJSON));
                return data;
            }
        }
        catch (err) {
            console.error("Error in getSectorChangeData validateResponseForNewFareFamily" + err);
            return data;
        }
        return finalFareFamilyResponse;
    }

    function formUpdatedFareFamilyResponse(resultantValue) {
        let resultJSON = {
            "Responses": {
                [tableName]: resultantValue
            },
            "UnprocessedKeys": {}
        };
        return resultJSON;
    }
};