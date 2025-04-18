'use strict';

// Mock dependencies
jest.mock('../getDataFromCommonConstants', () => ({
  fromConfigJson: jest.fn().mockResolvedValue('mockTableName'),
  getRestriciveLabel: jest.fn().mockReturnValue(['Free', 'Partial', 'Non-refundable'])
}));

jest.mock('../constants/constant', () => ({
  getCommonConstants: jest.fn().mockReturnValue({
    isoCodeLocaleMap: { "EN": "en_UK" }
  })
}));

const cancellationModule = require('../getCancellationDataFromDBNDC');
const getTableName = require('../getDataFromCommonConstants');

describe('getCancellationDataFromDBNDC', () => {
  
  describe('getcancellationData function', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should reject when data is falsy', async () => {
      // Arrange
      const data = null;
      const locale = 'en_UK';
      const currentBranch = 'main';
      
      // Act & Assert
      await expect(cancellationModule.getcancellationData(data, locale, currentBranch)).rejects.toEqual(null);
    });

    it('should process DB response with matching locale', async () => {
      // Arrange
      const mockData = {
        Responses: {
          mockTableName: [
            {
              priority: { N: '1' },
              jsonResponse: { 
                S: JSON.stringify({
                  rootContainer: {
                    isCancellation: true,
                    ChangeFeeDetails: {
                      language: 'en_UK',
                      CancellationFee: '£50',
                      CancellationFeeRules: 'Rules for cancellation'
                    }
                  }
                })
              }
            }
          ]
        }
      };
      const locale = 'en_UK';
      const currentBranch = 'main';
      
      // Act
      const result = await cancellationModule.getcancellationData(mockData, locale, currentBranch);
      
      // Assert
      expect(result).toEqual({
        isItineraryChangeAllowed: true,
        cancellationFeeValue: '£50',
        cancellationFeeLongDesc: 'Rules for cancellation'
      });
    });

    it('should process DB response with fallback to en_UK when locale not found', async () => {
      // Arrange
      const mockData = {
        Responses: {
          mockTableName: [
            {
              priority: { N: '1' },
              jsonResponse: { 
                S: JSON.stringify({
                  rootContainer: {
                    isCancellation: true,
                    ChangeFeeDetails: [
                      {
                        language: 'en_UK',
                        CancellationFee: '£50',
                        CancellationFeeRules: 'Rules for cancellation'
                      }
                    ]
                  }
                })
              }
            }
          ]
        }
      };
      const locale = 'fr_FR';
      const currentBranch = 'main';
      
      // Act
      const result = await cancellationModule.getcancellationData(mockData, locale, currentBranch);
      
      // Assert
      expect(result).toEqual({
        isItineraryChangeAllowed: true,
        cancellationFeeValue: '£50',
        cancellationFeeLongDesc: 'Rules for cancellation'
      });
    });

    it('should return empty values when no matching locale is found and en_UK is absent', async () => {
      // Arrange
      const mockData = {
        Responses: {
          mockTableName: [
            {
              priority: { N: '1' },
              jsonResponse: { 
                S: JSON.stringify({
                  rootContainer: {
                    isCancellation: true,
                    ChangeFeeDetails: [
                      {
                        language: 'es_ES',
                        CancellationFee: '€50',
                        CancellationFeeRules: 'Reglas para cancelación'
                      }
                    ]
                  }
                })
              }
            }
          ]
        }
      };
      const locale = 'fr_FR';
      const currentBranch = 'main';
      
      // Act
      const result = await cancellationModule.getcancellationData(mockData, locale, currentBranch);
      
      // Assert
      expect(result).toEqual({
        isItineraryChangeAllowed: "",
        cancellationFeeValue: "",
        cancellationFeeLongDesc: ""
      });
    });

    it('should return empty values when response count is 0', async () => {
      // Arrange
      const mockData = {
        Responses: {
          mockTableName: []
        }
      };
      const locale = 'en_UK';
      const currentBranch = 'main';
      
      // Act
      const result = await cancellationModule.getcancellationData(mockData, locale, currentBranch);
      
      // Assert
      expect(result).toEqual({
        isItineraryChangeAllowed: "",
        cancellationFeeValue: "",
        cancellationFeeLongDesc: ""
      });
    });

    it('should call validateResponseForNewFareFamily with valid data and date', async () => {
      // Arrange
      const mockData = {
        Responses: {
          mockTableName: [
            {
              priority: { N: '1' },
              jsonResponse: { 
                S: JSON.stringify({
                  rootContainer: {
                    isCancellation: true,
                    startDate: '01/01/2025',
                    endDate: '31/12/2025',
                    ChangeFeeDetails: {
                      language: 'en_UK',
                      CancellationFee: '£50',
                      CancellationFeeRules: 'Rules for cancellation'
                    }
                  }
                })
              }
            }
          ]
        }
      };
      const locale = 'en_UK';
      const currentBranch = 'main';
      const dateFromRequest = '15/04/2025';
      
      // Act
      const result = await cancellationModule.getcancellationData(mockData, locale, currentBranch, dateFromRequest);
      
      // Assert
      expect(result).toEqual({
        isItineraryChangeAllowed: true,
        cancellationFeeValue: '£50',
        cancellationFeeLongDesc: 'Rules for cancellation'
      });
    });

    it('should handle date validation with date object', async () => {
      // Arrange
      const mockData = {
        Responses: {
          mockTableName: [
            {
              priority: { N: '1' },
              jsonResponse: { 
                S: JSON.stringify({
                  rootContainer: {
                    isCancellation: true,
                    startDate: '01/01/2025',
                    endDate: '31/12/2025',
                    ChangeFeeDetails: {
                      language: 'en_UK',
                      CancellationFee: '£50',
                      CancellationFeeRules: 'Rules for cancellation'
                    }
                  }
                })
              }
            }
          ]
        }
      };
      const locale = 'en_UK';
      const currentBranch = 'main';
      const dateFromRequest = new Date('2025-04-15');
      
      // Act
      const result = await cancellationModule.getcancellationData(mockData, locale, currentBranch, dateFromRequest);
      
      // Assert
      expect(result).toEqual({
        isItineraryChangeAllowed: true,
        cancellationFeeValue: '£50',
        cancellationFeeLongDesc: 'Rules for cancellation'
      });
    });
    
  });

  describe('getcancellationDataResponse function', () => {
    it('should handle one bound with one segment', () => {
      // Arrange
      const cancellationFeeArray = [[{
        cancellationFeeValue: '£50',
        cancellationFeeLongDesc: 'Rules for cancellation'
      }]];
      const locale = 'en_UK';

      // Act
      const result = cancellationModule.getcancellationDataResponse(cancellationFeeArray, locale);

      // Assert
      expect(result).toEqual([{
        beforeDeparture: {
          description: {
            plainText: {
              longDescription: 'Rules for cancellation',
              shortDescription: '£50'
            }
          }
        }
      }]);
    });

    it('should handle round trip with restrictive logic', () => {
      // Arrange
      const cancellationFeeArray = [
        {
          cancellationFeeValue: '£50',
          cancellationFeeLongDesc: 'Rules for outbound'
        },
        {
          cancellationFeeValue: '£60',
          cancellationFeeLongDesc: 'Rules for inbound'
        }
      ];
      const locale = 'en_UK';

      // Mock getRestriciveLabel
      getTableName.getRestriciveLabel.mockReturnValue(['Free', 'Partial', 'Non-refundable']);

      // Act
      const result = cancellationModule.getcancellationDataResponse(cancellationFeeArray, locale);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].beforeDeparture.description.plainText.shortDescription).toBe('£60');
      expect(result[1].beforeDeparture.description.plainText.shortDescription).toBe('£60');
    });
  });

  describe('applyRestrictiveLogic function', () => {
    beforeEach(() => {
      getTableName.getRestriciveLabel.mockReturnValue(['Free', 'Partial', 'Non-refundable']);
    });

    it('should compare numeric values and apply restrictive logic', () => {
      // Arrange
      const cancellationFeeArray = [
        {
          cancellationFeeValue: '£50',
          cancellationFeeLongDesc: 'Lower fee'
        },
        {
          cancellationFeeValue: '£100',
          cancellationFeeLongDesc: 'Higher fee'
        }
      ];
      const locale = 'en_UK';

      // Act
      const result = cancellationModule.getcancellationDataResponse([cancellationFeeArray], locale);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].beforeDeparture.description.plainText.shortDescription).toBe('£100');
      expect(result[1].beforeDeparture.description.plainText.shortDescription).toBe('£100');
    });


    it('should compare mixed values (Non-refundable and numeric) and apply restrictive logic', () => {
      // Arrange
      const cancellationFeeArray = [
        {
          cancellationFeeValue: 'Non-refundable',
          cancellationFeeLongDesc: 'No refund'
        },
        {
          cancellationFeeValue: '£100',
          cancellationFeeLongDesc: 'Fee applies'
        }
      ];
      const locale = 'en_UK';

      // Act
      const result = cancellationModule.getcancellationDataResponse([cancellationFeeArray], locale);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].beforeDeparture.description.plainText.shortDescription).toBe('£100');
      expect(result[1].beforeDeparture.description.plainText.shortDescription).toBe('£100');
    });
  });


});