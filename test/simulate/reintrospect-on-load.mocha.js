/*
 * Copyright 2015-2016 Imply Data, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const expect = require('chai').expect;
const request = require('request');
const mockDruid = require('../utils/mock-druid');
const extend = require('../utils/extend');
const spawnServer = require('../utils/spawn-server');
const extractConfig = require('../utils/extract-config');

const TEST_PORT = 18082;
var pivotServer;

var segmentMetadataResponse = [
  {
    "id": "wikipedia_2015-09-12T00:00:00.000Z_2015-09-13T00:00:00.000Z_2016-06-17T19:58:57.097Z",
    "intervals": null,
    "columns": {
      "__time": {
        "type": "LONG",
        "hasMultipleValues": false,
        "size": 0,
        "cardinality": null,
        "minValue": null,
        "maxValue": null,
        "errorMessage": null
      },
      "count": {
        "type": "LONG",
        "hasMultipleValues": false,
        "size": 0,
        "cardinality": null,
        "minValue": null,
        "maxValue": null,
        "errorMessage": null
      },
      "channel": {
        "type": "STRING",
        "hasMultipleValues": false,
        "size": 0,
        "cardinality": 0,
        "minValue": null,
        "maxValue": null,
        "errorMessage": null
      }
    },
    "size": 0,
    "numRows": 390982,
    "aggregators": {
      "count": {
        "type": "longSum",
        "name": "count",
        "fieldName": "count"
      }
    }
  }
];

describe('reintrospect on load', function () {
  this.timeout(5000);

  var runSegmentMetadataRunNumber = 0;
  var expectedSegmentMetadataRunNumber = 1;

  before((done) => {
    mockDruid(28082, {
      onDataSources: function() {
        return {
          json: ['wikipedia']
        }
      },
      onQuery: function(query) {
        switch (query.queryType) {
          case 'segmentMetadata':
            expect(query.dataSource).to.equal('wikipedia');
            runSegmentMetadataRunNumber++;
            expect(runSegmentMetadataRunNumber).to.equal(expectedSegmentMetadataRunNumber);
            return {
              json: segmentMetadataResponse
            };

          case 'timeBoundary':
            expect(query.dataSource).to.equal('wikipedia');
            return {
              json: [
                {
                  "timestamp": "2015-09-12T23:59:00.000Z",
                  "result": {
                    "maxTime": "2015-09-12T23:59:00.000Z"
                  }
                }
              ]
            };

          default:
            throw new Error(`unknown query ${query.queryType}`);
        }
      }
    }).then(function() {
      pivotServer = spawnServer(`bin/pivot -c test/configs/reintrospect-on-load.yaml -p ${TEST_PORT}`, {
        env: {
          DRUID_HOST: 'localhost:28082'
        }
      });

      pivotServer.onHook(`Getting the latest MaxTime for`, done);
    });
  });

  it('works with initial GET /', (testComplete) => {
    expect(runSegmentMetadataRunNumber, 'run SM once').to.equal(1);

    expectedSegmentMetadataRunNumber++;

    request.get(`http://localhost:${TEST_PORT}/`, (err, response, body) => {
      expect(err).to.equal(null);
      expect(response.statusCode).to.equal(200);
      expect(body).to.contain('<!DOCTYPE html>');
      expect(body).to.contain('<title>Pivot');
      expect(body).to.contain('<div class="app-container"></div>');
      expect(body).to.contain('</html>');

      expect(runSegmentMetadataRunNumber).to.equal(2);

      var config = extractConfig(body);
      expect(config.appSettings.dataSources[0].dimensions).to.deep.equal([
        {
          "expression": {
            "name": "__time",
            "op": "ref"
          },
          "kind": "time",
          "name": "__time",
          "title": "Time"
        },
        {
          "expression": {
            "name": "channel",
            "op": "ref"
          },
          "kind": "string",
          "name": "channel",
          "title": "Channel"
        }
      ]);

      expect(config.appSettings.dataSources[0].measures).to.deep.equal([
        {
          "expression": {
            "action": {
              "action": "sum",
              "expression": {
                "name": "count",
                "op": "ref"
              }
            },
            "expression": {
              "name": "main",
              "op": "ref"
            },
            "op": "chain"
          },
          "name": "count",
          "title": "Count"
        }
      ]);

      testComplete();
    });
  });

  it('works with second GET /', (testComplete) => {
    segmentMetadataResponse[0].columns.added = {
      "type": "LONG",
      "hasMultipleValues": false,
      "size": 0,
      "cardinality": null,
      "minValue": null,
      "maxValue": null,
      "errorMessage": null
    };
    segmentMetadataResponse[0].columns.page = {
      "type": "STRING",
      "hasMultipleValues": false,
      "size": 0,
      "cardinality": 0,
      "minValue": null,
      "maxValue": null,
      "errorMessage": null
    };

    expectedSegmentMetadataRunNumber++;
    request.get(`http://localhost:${TEST_PORT}/`, (err, response, body) => {
      expect(err).to.equal(null);
      expect(response.statusCode).to.equal(200);
      expect(body).to.contain('<!DOCTYPE html>');
      expect(body).to.contain('<title>Pivot');
      expect(body).to.contain('<div class="app-container"></div>');
      expect(body).to.contain('</html>');

      expect(runSegmentMetadataRunNumber).to.equal(3);

      var config = extractConfig(body);
      expect(config.appSettings.dataSources[0].dimensions).to.deep.equal([
        {
          "expression": {
            "name": "__time",
            "op": "ref"
          },
          "kind": "time",
          "name": "__time",
          "title": "Time"
        },
        {
          "expression": {
            "name": "channel",
            "op": "ref"
          },
          "kind": "string",
          "name": "channel",
          "title": "Channel"
        },
        {
          "expression": {
            "name": "page",
            "op": "ref"
          },
          "kind": "string",
          "name": "page",
          "title": "Page"
        }
      ]);

      expect(config.appSettings.dataSources[0].measures).to.deep.equal([
        {
          "expression": {
            "action": {
              "action": "sum",
              "expression": {
                "name": "count",
                "op": "ref"
              }
            },
            "expression": {
              "name": "main",
              "op": "ref"
            },
            "op": "chain"
          },
          "name": "count",
          "title": "Count"
        },
        {
          "expression": {
            "action": {
              "action": "sum",
              "expression": {
                "name": "added",
                "op": "ref"
              }
            },
            "expression": {
              "name": "main",
              "op": "ref"
            },
            "op": "chain"
          },
          "name": "added",
          "title": "Added"
        }
      ]);

      testComplete();
    });
  });

  after(() => {
    pivotServer.kill();
  });

});
