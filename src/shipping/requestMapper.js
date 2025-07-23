const {getHostname} = require("../helper");

const mapWebSocketMessage = (data) => {
    let requestData = {
        shippingData: {}
    };

    requestData.shippingData.workplaceIdentifier = getHostname();

    if (data.hasOwnProperty('overrideShipmentTypeId')) {
        requestData.shippingData.overrideShipmentTypeId = data.overrideShipmentTypeId;
    }

    if (data.hasOwnProperty('packagingProductTray')) {
        requestData.shippingData.packagingProductTray = data.packagingProductTray;
    }

    const shippingRequestPackages = data.shippingRequestPackages || data.packageData
    if (shippingRequestPackages) {
        requestData.shippingData.shippingRequestPackages = [];
        shippingRequestPackages.forEach((shippingRequestPackage) => {
            let requestPackage = {
                packageNumber: shippingRequestPackage.packageNumber || shippingRequestPackage.packageId
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
