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

import { expect } from 'chai';
import { testImmutableClass } from 'immutable-class/build/tester';
import * as Q from 'q';

import { $, Expression, AttributeInfo } from 'plywood';
import { Cluster } from "../cluster/cluster";
import { DataSource, DataSourceJS } from './data-source';
import { DataSourceMock} from './data-source.mock';

describe('DataSource', () => {
  var druidCluster = Cluster.fromJS({
    name: 'druid',
    type: 'druid'
  });

  var context = {
    cluster: druidCluster
  };

  it('is an immutable class', () => {
    testImmutableClass<DataSourceJS>(DataSource, [
      DataSourceMock.TWITTER_JS,
      DataSourceMock.WIKI_JS
    ]);
  });

  describe("validates", () => {
    it("throws an error if bad name is used", () => {
      expect(() => {
        DataSource.fromJS({
          name: 'wiki hello',
          clusterName: 'druid',
          source: 'wiki',
          attributes: [
            { name: '__time', type: 'TIME' },
            { name: 'articleName', type: 'STRING' },
            { name: 'count', type: 'NUMBER' }
          ],
          dimensions: [
            {
              name: 'articleName',
              expression: '$articleName'
            }
          ],
          measures: [
            {
              name: 'count',
              expression: '$main.sum($count)'
            }
          ]
        });
      }).to.throw("'wiki hello' is not a URL safe name. Try 'wiki_hello' instead?");
    });

    it("throws an error if the defaultSortMeasure can not be found", () => {
      expect(() => {
        DataSource.fromJS({
          name: 'wiki',
          clusterName: 'druid',
          source: 'wiki',
          defaultSortMeasure: 'gaga',
          attributes: [
            { name: '__time', type: 'TIME' },
            { name: 'articleName', type: 'STRING' },
            { name: 'count', type: 'NUMBER' }
          ],
          dimensions: [
            {
              name: 'articleName',
              expression: '$articleName'
            }
          ],
          measures: [
            {
              name: 'count',
              expression: '$main.sum($count)'
            }
          ]
        });
      }).to.throw("can not find defaultSortMeasure 'gaga'");
    });

    it("throws an error if duplicate name is used across measures and dimensions", () => {
      expect(() => {
        DataSource.fromJS({
          name: 'wiki',
          clusterName: 'druid',
          source: 'wiki',
          attributes: [
            { name: '__time', type: 'TIME' },
            { name: 'articleName', type: 'STRING' },
            { name: 'count', type: 'NUMBER' }
          ],
          dimensions: [
            {
              name: 'articleName',
              expression: '$articleName'
            }
          ],
          measures: [
            {
              name: 'articleName',
              expression: '$main.sum($count)'
            }
          ]
        });
      }).to.throw("name 'articleName' found in both dimensions and measures in data source: 'wiki'");
    });

    it("throws an error if duplicate name is used in measures", () => {
      expect(() => {
        DataSource.fromJS({
          name: 'wiki',
          clusterName: 'druid',
          source: 'wiki',
          attributes: [
            { name: '__time', type: 'TIME' },
            { name: 'articleName', type: 'STRING' },
            { name: 'count', type: 'NUMBER' }
          ],
          dimensions: [
            {
              name: 'notArticleName',
              expression: '$notArticleName'
            }
          ],
          measures: [
            {
              name: 'articleName',
              expression: '$main.sum($count)'
            },
            {
              name: 'articleName',
              expression: '$articleName'
            }
          ]
        });
      }).to.throw("duplicate measure name 'articleName' found in data source: 'wiki'");
    });

    it("throws an error if duplicate name is used in dimensions", () => {
      expect(() => {
        DataSource.fromJS({
          name: 'wiki',
          clusterName: 'druid',
          source: 'wiki',
          attributes: [
            { name: '__time', type: 'TIME' },
            { name: 'articleName', type: 'STRING' },
            { name: 'count', type: 'NUMBER' }
          ],
          dimensions: [
            {
              name: 'articleName',
              expression: '$articleName'
            },
            {
              name: 'articleName',
              expression: '$articleName.substr(0,2)'
            }
          ],
          measures: [
            {
              name: 'articleName',
              expression: '$main.sum($count)'
            }
          ]
        });
      }).to.throw("duplicate dimension name 'articleName' found in data source: 'wiki'");
    });

  });

  describe("#getIssues", () => {
    it("raises issues", () => {
      var dataSource = DataSource.fromJS({
        name: 'wiki',
        clusterName: 'druid',
        source: 'wiki',
        attributes: [
          { name: '__time', type: 'TIME' },
          { name: 'articleName', type: 'STRING' },
          { name: 'count', type: 'NUMBER' }
        ],
        dimensions: [
          {
            name: 'gaga',
            expression: '$gaga'
          },
          {
            name: 'bucketArticleName',
            expression: $('articleName').numberBucket(5).toJS()
          }
        ],
        measures: [
          {
            name: 'count',
            expression: '$main.sum($count)'
          },
          {
            name: 'added',
            expression: '$main.sum($added)'
          },
          {
            name: 'sumArticleName',
            expression: '$main.sum($articleName)'
          },
          {
            name: 'koalaCount',
            expression: '$koala.sum($count)'
          },
          {
            name: 'countByThree',
            expression: '$count / 3'
          }
        ]
      });

      expect(dataSource.getIssues()).to.deep.equal([
        "failed to validate dimension 'gaga': could not resolve $gaga",
        "failed to validate dimension 'bucketArticleName': numberBucket must have input of type NUMBER or NUMBER_RANGE (is STRING)",
        "failed to validate measure 'added': could not resolve $added",
        "failed to validate measure 'sumArticleName': sum must have expression of type NUMBER (is STRING)",
        "failed to validate measure 'koalaCount': measure must contain a $main reference",
        "failed to validate measure 'countByThree': measure must contain a $main reference"
      ]);
    });
  });


  describe.only("back compat", () => {
    it("works in a generic case", () => {
      var legacyDataSourceJS: any = {
        "name": "wiki",
        "engine": "druid",
        "source": "wiki",
        "subsetFilter": null,
        "dimensions": [
          {
            "kind": "time",
            "name": "__time",
            "expression": "$__time"
          },
          {
            "name": "page"
          }
        ],
        "measures": [
          {
            "name": "added",
            "expression": "$main.sum($added)"
          }
        ],
        "options": {
          "skipIntrospection": true,
          "attributeOverrides": [
            {
              name: 'page',
              type: 'STRING'
            }
          ],
          "defaultSplits": "__time",
          "priority": 13
        }
      };

      var dataSource = DataSource.fromJS(legacyDataSourceJS, context);

      expect(dataSource.toJS()).to.deep.equal({
        "attributeOverrides": [
          {
            "name": "page",
            "type": "STRING"
          }
        ],
        "clusterName": "druid",
        "defaultSortMeasure": "added",
        "defaultSplits": [
          {
            "expression": {
              "name": "__time",
              "op": "ref"
            }
          }
        ],
        "description": "",
        "dimensions": [
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
              "name": "page",
              "op": "ref"
            },
            "kind": "string",
            "name": "page",
            "title": "Page"
          }
        ],
        "introspection": "none",
        "measures": [
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
        ],
        "name": "wiki",
        "options": {
          "priority": 13
        },
        "refreshRule": {
          "refresh": "PT1M",
          "rule": "query"
        },
        "source": "wiki",
        "subsetFilter": null,
        "timeAttribute": "__time",
        "title": "Wiki"
      });

    });

  });


  describe("#deduceAttributes", () => {
    it("works in a generic case", () => {
      var dataSource = DataSource.fromJS({
        "name": "wiki",
        "clusterName": "druid",
        "source": "wiki",
        "subsetFilter": null,
        introspection: 'autofill-all',
        "defaultDuration": "P1D",
        "defaultFilter": { "op": "literal", "value": true },
        "defaultSortMeasure": "added",
        "defaultTimezone": "Etc/UTC",
        "dimensions": [
          {
            "kind": "time",
            "name": "__time",
            "expression": "$__time"
          },
          {
            "name": "page"
          },
          {
            "name": "pageInBrackets",
            "expression": "'[' ++ $page ++ ']'"
          },
          {
            "name": "userInBrackets",
            "expression": "'[' ++ $user ++ ']'"
          },
          {
            "name": "languageLookup",
            "expression": "$language.lookup(wiki_language_lookup)"
          }
        ],
        "measures": [
          {
            "name": "added",
            "expression": "$main.sum($added)"
          },
          {
            "name": "addedByDeleted",
            "expression": "$main.sum($added) / $main.sum($deleted)"
          },
          {
            "name": "unique_user",
            "expression": "$main.countDistinct($unique_user)"
          }
        ]
      }, context);

      expect(AttributeInfo.toJSs(dataSource.deduceAttributes())).to.deep.equal([
        {
          "name": "__time",
          "type": "TIME"
        },
        {
          "name": "page",
          "type": "STRING"
        },
        {
          "name": "user",
          "type": "STRING"
        },
        {
          "name": "language",
          "type": "STRING"
        },
        {
          "name": "added",
          "type": "NUMBER"
        },
        {
          "name": "deleted",
          "type": "NUMBER"
        },
        {
          "name": "unique_user",
          "special": "unique",
          "type": "STRING"
        }
      ]);

    });

  });


  describe("#addAttributes", () => {
    var dataSourceStub = DataSource.fromJS({
      name: 'wiki',
      title: 'Wiki',
      clusterName: 'druid',
      source: 'wiki',
      subsetFilter: null,
      introspection: 'autofill-all',
      defaultTimezone: 'Etc/UTC',
      defaultFilter: { op: 'literal', value: true },
      refreshRule: {
        refresh: "PT1M",
        rule: "fixed"
      }
    });

    it("works in basic case (no count) + re-add", () => {
      var attributes1 = AttributeInfo.fromJSs([
        { name: '__time', type: 'TIME' },
        { name: 'page', type: 'STRING' },
        { name: 'added', type: 'NUMBER' },
        { name: 'unique_user', special: 'unique' }
      ]);

      var dataSource1 = dataSourceStub.addAttributes(attributes1);
      expect(dataSource1.toJS()).to.deep.equal({
        "name": "wiki",
        "title": "Wiki",
        "description": "",
        "clusterName": "druid",
        "source": "wiki",
        "refreshRule": {
          "refresh": "PT1M",
          "rule": "fixed"
        },
        "subsetFilter": null,
        introspection: 'autofill-all',
        "defaultDuration": "P1D",
        "defaultFilter": { "op": "literal", "value": true },
        "defaultSortMeasure": "added",
        "defaultTimezone": "Etc/UTC",
        "timeAttribute": '__time',
        "attributes": [
          { name: '__time', type: 'TIME' },
          { name: 'page', type: 'STRING' },
          { name: 'added', type: 'NUMBER' },
          { name: 'unique_user', special: 'unique', "type": "STRING" }
        ],
        "dimensions": [
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
              "name": "page",
              "op": "ref"
            },
            "kind": "string",
            "name": "page",
            "title": "Page"
          }
        ],
        "measures": [
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
          },
          {
            "expression": {
              "action": {
                "action": "countDistinct",
                "expression": {
                  "name": "unique_user",
                  "op": "ref"
                }
              },
              "expression": {
                "name": "main",
                "op": "ref"
              },
              "op": "chain"
            },
            "name": "unique_user",
            "title": "Unique User"
          }
        ]
      });

      var attributes2 = AttributeInfo.fromJSs([
        { name: '__time', type: 'TIME' },
        { name: 'page', type: 'STRING' },
        { name: 'added', type: 'NUMBER' },
        { name: 'deleted', type: 'NUMBER' },
        { name: 'unique_user', special: 'unique' },
        { name: 'user', type: 'STRING' }
      ]);

      var dataSource2 = dataSource1.addAttributes(attributes2);
      expect(dataSource2.toJS()).to.deep.equal({
        "name": "wiki",
        "title": "Wiki",
        "description": "",
        "clusterName": "druid",
        "source": "wiki",
        "refreshRule": {
          "refresh": "PT1M",
          "rule": "fixed"
        },
        "subsetFilter": null,
        introspection: 'autofill-all',
        "defaultDuration": "P1D",
        "defaultFilter": { "op": "literal", "value": true },
        "defaultSortMeasure": "added",
        "defaultTimezone": "Etc/UTC",
        "timeAttribute": '__time',
        "attributes": [
          { name: '__time', type: 'TIME' },
          { name: 'page', type: 'STRING' },
          { name: 'added', type: 'NUMBER' },
          { name: 'unique_user', special: 'unique', "type": "STRING" },
          { name: 'deleted', type: 'NUMBER' },
          { name: 'user', type: 'STRING' }
        ],
        "dimensions": [
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
              "name": "page",
              "op": "ref"
            },
            "kind": "string",
            "name": "page",
            "title": "Page"
          },
          {
            "expression": {
              "name": "user",
              "op": "ref"
            },
            "kind": "string",
            "name": "user",
            "title": "User"
          }
        ],
        "measures": [
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
          },
          {
            "expression": {
              "action": {
                "action": "countDistinct",
                "expression": {
                  "name": "unique_user",
                  "op": "ref"
                }
              },
              "expression": {
                "name": "main",
                "op": "ref"
              },
              "op": "chain"
            },
            "name": "unique_user",
            "title": "Unique User"
          },
          {
            "expression": {
              "action": {
                "action": "sum",
                "expression": {
                  "name": "deleted",
                  "op": "ref"
                }
              },
              "expression": {
                "name": "main",
                "op": "ref"
              },
              "op": "chain"
            },
            "name": "deleted",
            "title": "Deleted"
          }
        ]
      });
    });

    it("works with non-url-safe names", () => {
      var attributes1 = AttributeInfo.fromJSs([
        { name: '__time', type: 'TIME' },
        { name: 'page:#love$', type: 'STRING' },
        { name: 'added:#love$', type: 'NUMBER' },
        { name: 'unique_user:#love$', special: 'unique' }
      ]);

      var dataSource = dataSourceStub.addAttributes(attributes1);
      expect(dataSource.toJS()).to.deep.equal({
        "attributes": [
          {
            "name": "__time",
            "type": "TIME"
          },
          {
            "name": "page:#love$",
            "type": "STRING"
          },
          {
            "name": "added:#love$",
            "type": "NUMBER"
          },
          {
            "name": "unique_user:#love$",
            "special": "unique",
            "type": "STRING"
          }
        ],
        "defaultDuration": "P1D",
        "defaultFilter": {
          "op": "literal",
          "value": true
        },
        "defaultSortMeasure": "added_love_",
        "defaultTimezone": "Etc/UTC",
        "dimensions": [
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
              "name": "page:#love$",
              "op": "ref"
            },
            "kind": "string",
            "name": "page_love_",
            "title": "Page Love"
          }
        ],
        "engine": "druid",
        "introspection": "autofill-all",
        "measures": [
          {
            "expression": {
              "action": {
                "action": "sum",
                "expression": {
                  "name": "added:#love$",
                  "op": "ref"
                }
              },
              "expression": {
                "name": "main",
                "op": "ref"
              },
              "op": "chain"
            },
            "name": "added_love_",
            "title": "Added Love"
          },
          {
            "expression": {
              "action": {
                "action": "countDistinct",
                "expression": {
                  "name": "unique_user:#love$",
                  "op": "ref"
                }
              },
              "expression": {
                "name": "main",
                "op": "ref"
              },
              "op": "chain"
            },
            "name": "unique_user_love_",
            "title": "Unique User Love"
          }
        ],
        "name": "wiki",
        "refreshRule": {
          "refresh": "PT1M",
          "rule": "fixed"
        },
        "source": "wiki",
        "subsetFilter": null,
        "timeAttribute": "__time",
        "title": "Wiki",
        "description": ""
      });
    });

    it("works with existing dimension", () => {
      var attributes1 = AttributeInfo.fromJSs([
        { name: '__time', type: 'TIME' },
        { name: 'added', type: 'NUMBER' },
        { name: 'added!!!', type: 'NUMBER' },
        { name: 'deleted', type: 'NUMBER' }
      ]);

      var dataSourceWithDim = DataSource.fromJS({
        name: 'wiki',
        title: 'Wiki',
        clusterName: 'druid',
        source: 'wiki',
        subsetFilter: null,
        introspection: 'autofill-all',
        defaultTimezone: 'Etc/UTC',
        defaultFilter: { op: 'literal', value: true },
        refreshRule: {
          refresh: "PT1M",
          rule: "fixed"
        },
        dimensions: [
          {
            name: 'added',
            expression: '$added'
          },
          {
            name: 'added_',
            expression: '${added!!!}'
          }
        ]
      });

      var dataSource = dataSourceWithDim.addAttributes(attributes1);
      expect(dataSource.toJS().measures.map(m => m.name)).to.deep.equal(['deleted']);
    });

  });


  describe("#addAttributes (new dim)", () => {
    var dataSource = DataSource.fromJS({
      name: 'wiki',
      title: 'Wiki',
      clusterName: 'druid',
      source: 'wiki',
      subsetFilter: null,
      introspection: 'autofill-all',
      defaultTimezone: 'Etc/UTC',
      defaultFilter: { op: 'literal', value: true },
      refreshRule: {
        refresh: "PT1M",
        rule: "fixed"
      }
    });

    it('adds new dimensions', () => {
      var columns: any = [
        { "name": "__time", "type": "TIME" },
        { "name": "added", "makerAction": { "action": "sum", "expression": { "name": "added", "op": "ref" }}, "type": "NUMBER", "unsplitable": true },
        { "name": "count", "makerAction": { "action": "count"}, "type": "NUMBER", "unsplitable": true },
        { "name": "delta_hist", "special": "histogram", "type": "NUMBER" },
        { "name": "page", "type": "STRING" },
        { "name": "page_unique", "special": "unique", "type": "STRING" }
      ];

      var dataSource1 = dataSource.addAttributes(AttributeInfo.fromJSs(columns));

      expect(dataSource1.toJS().dimensions).to.deep.equal([
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
            "name": "page",
            "op": "ref"
          },
          "kind": "string",
          "name": "page",
          "title": "Page"
        }
      ]);

      columns.push({ "name": "channel", "type": "STRING" });
      var dataSource2 = dataSource1.addAttributes(AttributeInfo.fromJSs(columns));

      expect(dataSource2.toJS().dimensions).to.deep.equal([
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
            "name": "page",
            "op": "ref"
          },
          "kind": "string",
          "name": "page",
          "title": "Page"
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

    });

  });

});
