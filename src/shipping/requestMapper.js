const {getHostname} = require("../helper");

/**
 * Bereinigt die Verpackungsmaterialien eines Pakets für den Shipout:
 * nur productId > 0, productId/count als Integer, count mindestens 1,
 * doppelte productId zusammengefasst (Reihenfolge des ersten Auftretens),
 * nur die Schlüssel productId und count.
 *
 * @param {*} packagingMaterials
 * @returns {{productId: number, count: number}[]}
 */
const normalizePackagingMaterials = (packagingMaterials) => {
    if (!Array.isArray(packagingMaterials)) {
        return [];
    }

    const result = [];
    const byProductId = new Map();
    packagingMaterials.forEach((material) => {
        if (!material || typeof material !== 'object') {
            return;
        }

        const productId = parseInt(material.productId, 10);
        if (!(productId > 0)) {
            return;
        }

        let count = parseInt(material.count, 10);
        if (!(count >= 1)) {
            count = 1;
        }

        if (byProductId.has(productId)) {
            byProductId.get(productId).count += count;
            return;
        }

        const entry = {productId, count};
        byProductId.set(productId, entry);
        result.push(entry);
    });

    return result;
};

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

            if (shippingRequestPackage.hasOwnProperty('width')) {
                requestPackage.width = shippingRequestPackage.width;
            }

            if (shippingRequestPackage.hasOwnProperty('length')) {
                requestPackage.length = shippingRequestPackage.length;
            }

            if (shippingRequestPackage.hasOwnProperty('height')) {
                requestPackage.height = shippingRequestPackage.height;
            }

            if (shippingRequestPackage.hasOwnProperty('services') && shippingRequestPackage.services.length > 0) {
                requestPackage.services = shippingRequestPackage.services;
            }

            if (shippingRequestPackage.hasOwnProperty('products') && shippingRequestPackage.products.length > 0) {
                requestPackage.products = shippingRequestPackage.products;
            }

            const packagingMaterials = normalizePackagingMaterials(shippingRequestPackage.packagingMaterials);
            if (packagingMaterials.length > 0) {
                requestPackage.packagingMaterials = packagingMaterials;
            } else if (shippingRequestPackage.hasOwnProperty('packagingProductId') && shippingRequestPackage.packagingProductId > 0) {
                requestPackage.packagingProductId = shippingRequestPackage.packagingProductId;
            }

            requestData.shippingData.shippingRequestPackages.push(requestPackage);
        });
    }

    return requestData;
};

module.exports = mapWebSocketMessage;
module.exports.normalizePackagingMaterials = normalizePackagingMaterials;
