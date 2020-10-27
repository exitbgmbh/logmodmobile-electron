const {getHostname} = require("../helper");

const mapWebSocketMessage = (data) => {
    let requestData = {
        shippingData: {}
    };
    
    requestData.shippingData.workplaceIdentifier = getHostname();

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

            if (shippingRequestPackage.hasOwnProperty('services') && shippingRequestPackage.services.length > 0) {
                requestPackage.services = shippingRequestPackage.services;
            }

            if (shippingRequestPackage.hasOwnProperty('products') && shippingRequestPackage.products.length > 0) {
                requestPackage.products = shippingRequestPackage.products;
            }

            if (shippingRequestPackage.hasOwnProperty('packagingProductId') && shippingRequestPackage.packagingProductId > 0) {
                requestPackage.packagingProductId = shippingRequestPackage.packagingProductId;
            }

            requestData.shippingData.shippingRequestPackages.push(requestPackage);
        });
    }

    return requestData;
};

module.exports = mapWebSocketMessage;