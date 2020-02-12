const mapWebSocketMessage = (data) => {
    let requestData = {
        shippingData: {}
    };

    if (data.hasOwnProperty('overrideShipmentTypeId')) {
        requestData.shippingData.overrideShipmentTypeId = data.overrideShipmentTypeId;
    }

    if (data.hasOwnProperty('packageData')) {
        requestData.shippingData.shippingRequestPackages = [];
        data.packageData.forEach((shippingRequestPackage) => {
            let requestPackage = {
                packageNumber: shippingRequestPackage.packageId
            };

            if (shippingRequestPackage.hasOwnProperty('weight')) {
                requestPackage.weight = shippingRequestPackage.weight;
            }

            // not support atm
            // if (shippingRequestPackage.hasOwnProperty('services') && shippingRequestPackage.services.length > 0) {
            // }

            requestData.shippingData.shippingRequestPackages.push(requestPackage);
        });
    }

    return requestData;
};

module.exports = mapWebSocketMessage;