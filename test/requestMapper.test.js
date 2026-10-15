const { expect } = require('chai');
const mapWebSocketMessage = require('../src/shipping/requestMapper');
const { normalizePackagingMaterials } = require('../src/shipping/requestMapper');

const mapPackage = (pkg, key = 'packageData') => {
    const result = mapWebSocketMessage({ [key]: [pkg] });
    return result.shippingData.shippingRequestPackages[0];
};

describe('requestMapper', () => {
    describe('normalizePackagingMaterials', () => {
        it('liefert für Nicht-Arrays eine leere Liste', () => {
            expect(normalizePackagingMaterials(undefined)).to.deep.equal([]);
            expect(normalizePackagingMaterials(null)).to.deep.equal([]);
            expect(normalizePackagingMaterials('5')).to.deep.equal([]);
        });

        it('erhält zwei Materialien mit ihren Mengen', () => {
            expect(normalizePackagingMaterials([
                { productId: 5, count: 2 },
                { productId: 9, count: 1 },
            ])).to.deep.equal([
                { productId: 5, count: 2 },
                { productId: 9, count: 1 },
            ]);
        });

        it('fasst doppelte productId zusammen und erhält die Reihenfolge', () => {
            expect(normalizePackagingMaterials([
                { productId: 5, count: 2 },
                { productId: 9, count: 1 },
                { productId: '5', count: '1' },
            ])).to.deep.equal([
                { productId: 5, count: 3 },
                { productId: 9, count: 1 },
            ]);
        });

        it('setzt fehlende, 0 oder ungültige count auf 1', () => {
            expect(normalizePackagingMaterials([
                { productId: 1 },
                { productId: 2, count: 0 },
                { productId: 3, count: 'abc' },
                { productId: 4, count: -2 },
            ])).to.deep.equal([
                { productId: 1, count: 1 },
                { productId: 2, count: 1 },
                { productId: 3, count: 1 },
                { productId: 4, count: 1 },
            ]);
        });

        it('verwirft productId 0 oder ungültige productId', () => {
            expect(normalizePackagingMaterials([
                { productId: 0, count: 3 },
                { productId: 'abc', count: 1 },
                { productId: -4, count: 1 },
                { count: 2 },
                null,
                { productId: 8, count: 1 },
            ])).to.deep.equal([
                { productId: 8, count: 1 },
            ]);
        });

        it('entfernt zusätzliche Schlüssel', () => {
            const result = normalizePackagingMaterials([
                { productId: 5, count: 2, barcode: '4001234567890', name: 'Karton' },
            ]);
            expect(result).to.deep.equal([{ productId: 5, count: 2 }]);
            expect(Object.keys(result[0])).to.deep.equal(['productId', 'count']);
        });
    });

    describe('mapWebSocketMessage', () => {
        it('bildet das Beispiel aus AC1 ab und sendet kein packagingProductId', () => {
            const pkg = mapPackage({
                packageId: 'P1',
                packagingMaterials: [
                    { productId: 5, count: 2 },
                    { productId: 9, count: 1 },
                    { productId: 5, count: 1 },
                    { productId: 0, count: 3 },
                ],
            });
            expect(pkg.packagingMaterials).to.deep.equal([
                { productId: 5, count: 3 },
                { productId: 9, count: 1 },
            ]);
            expect(pkg).to.not.have.property('packagingProductId');
        });

        it('übernimmt nur packagingProductId wie bisher', () => {
            const pkg = mapPackage({ packageId: 'P1', packagingProductId: 7 });
            expect(pkg.packagingProductId).to.equal(7);
            expect(pkg).to.not.have.property('packagingMaterials');
        });

        it('sendet ohne beide Felder keines davon', () => {
            const pkg = mapPackage({ packageId: 'P1', weight: 1.5 });
            expect(pkg).to.not.have.property('packagingProductId');
            expect(pkg).to.not.have.property('packagingMaterials');
            expect(pkg).to.deep.equal({ packageNumber: 'P1', weight: 1.5 });
        });

        it('sendet bei beiden Feldern nur packagingMaterials', () => {
            const pkg = mapPackage({
                packageId: 'P1',
                packagingProductId: 7,
                packagingMaterials: [{ productId: 5, count: 2 }],
            });
            expect(pkg.packagingMaterials).to.deep.equal([{ productId: 5, count: 2 }]);
            expect(pkg).to.not.have.property('packagingProductId');
        });

        it('fällt bei leerer bereinigter Liste auf packagingProductId zurück', () => {
            const pkg = mapPackage({
                packageId: 'P1',
                packagingProductId: 7,
                packagingMaterials: [{ productId: 0, count: 1 }],
            });
            expect(pkg.packagingProductId).to.equal(7);
            expect(pkg).to.not.have.property('packagingMaterials');
        });

        it('liefert über shippingRequestPackages (AutoStore) dasselbe wie über packageData', () => {
            const content = {
                packagingProductId: 7,
                packagingMaterials: [
                    { productId: 5, count: 2, barcode: 'x' },
                    { productId: 9 },
                    { productId: 5, count: 1 },
                    { productId: 0, count: 3 },
                ],
            };
            const viaWebSocket = mapPackage({ packageId: 'P1', ...content }, 'packageData');
            const viaAutoStore = mapPackage({ packageNumber: 'P1', ...content }, 'shippingRequestPackages');
            expect(viaAutoStore).to.deep.equal(viaWebSocket);
            expect(viaAutoStore.packagingMaterials).to.deep.equal([
                { productId: 5, count: 3 },
                { productId: 9, count: 1 },
            ]);
        });
    });
});
