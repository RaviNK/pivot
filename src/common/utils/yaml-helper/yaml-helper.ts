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

import { $, AttributeInfo, RefExpression } from 'plywood';
import { DataSource, Dimension, Measure, Cluster } from '../../../common/models/index';

function spaces(n: number) {
  return (new Array(n + 1)).join(' ');
}

function yamlObject(lines: string[], indent = 2): string[] {
  var pad = spaces(indent);
  return lines.map((line, i) => {
    if (line === '') return '';
    return pad + (i ? '  ' : '- ') + line;
  });
}

interface PropAdderOptions {
  object: any;
  propName: string;
  comment?: string;
  defaultValue?: any;
}

function yamlPropAdder(lines: string[], withComments: boolean, options: PropAdderOptions): void {
  const { object, propName, defaultValue, comment } = options;

  var value = object[propName];
  if (value == null) {
    if (withComments && typeof defaultValue !== "undefined") {
      lines.push(
        '',
        `# ${comment}`,
        `#${propName}: ${defaultValue} # <- default`
      );
    }
  } else {
    if (withComments) lines.push(
      '',
      `# ${comment}`
    );
    lines.push(`${propName}: ${value}`);
  }
}

export function clusterToYAML(cluster: Cluster, withComments: boolean): string[] {
  var lines: string[] = [
    `name: ${cluster.name}`
  ];

  yamlPropAdder(lines, withComments, {
    object: cluster,
    propName: 'type',
    comment: 'The type of the data store can be (druid, mysql, or postgres)'
  });

  yamlPropAdder(lines, withComments, {
    object: cluster,
    propName: 'host',
    comment: 'The host (hostname:port) of the cluster. In the Druid case this must be the broker.'
  });

  yamlPropAdder(lines, withComments, {
    object: cluster,
    propName: 'version',
    comment: 'The explicit version to use for this cluster.'
  });

  yamlPropAdder(lines, withComments, {
    object: cluster,
    propName: 'timeout',
    comment: 'The timeout to set on the queries in ms.',
    defaultValue: Cluster.DEFAULT_TIMEOUT
  });

  yamlPropAdder(lines, withComments, {
    object: cluster,
    propName: 'sourceListScan',
    comment: 'Should the sources of this cluster be automatically scanned and new sources added as data sources.',
    defaultValue: Cluster.DEFAULT_SOURCE_LIST_SCAN
  });

  yamlPropAdder(lines, withComments, {
    object: cluster,
    propName: 'sourceListRefreshOnLoad',
    comment: 'Should the list of sources be reloaded every time that Pivot is loaded.',
    defaultValue: false
  });

  yamlPropAdder(lines, withComments, {
    object: cluster,
    propName: 'sourceListRefreshInterval',
    comment: 'How often should sources be reloaded in ms.',
    defaultValue: Cluster.DEFAULT_SOURCE_LIST_REFRESH_INTERVAL
  });

  yamlPropAdder(lines, withComments, {
    object: cluster,
    propName: 'sourceReintrospectOnLoad',
    comment: 'Should sources be scanned for additional dimensions every time that Pivot is loaded.',
    defaultValue: false
  });

  yamlPropAdder(lines, withComments, {
    object: cluster,
    propName: 'sourceReintrospectInterval',
    comment: 'How often should source schema be reloaded in ms.',
    defaultValue: Cluster.DEFAULT_SOURCE_REINTROSPECT_INTERVAL
  });

  if (withComments) {
    lines.push(
      '',
      `# Database specific (${cluster.type}) ===============`
    );
  }
  switch (cluster.type) {
    case 'druid':
      yamlPropAdder(lines, withComments, {
        object: cluster,
        propName: 'introspectionStrategy',
        comment: 'The introspection strategy for the Druid external.',
        defaultValue: Cluster.DEFAULT_INTROSPECTION_STRATEGY
      });

      yamlPropAdder(lines, withComments, {
        object: cluster,
        propName: 'requestDecorator',
        comment: 'The request decorator module filepath to load.'
      });
      break;

    case 'postgres':
    case 'mysql':
      yamlPropAdder(lines, withComments, {
        object: cluster,
        propName: 'database',
        comment: 'The database to which to connect to.'
      });

      yamlPropAdder(lines, withComments, {
        object: cluster,
        propName: 'user',
        comment: 'The user to connect as. This user needs no permissions other than SELECT.'
      });

      yamlPropAdder(lines, withComments, {
        object: cluster,
        propName: 'password',
        comment: 'The password to use with the provided user.'
      });
      break;
  }

  lines.push('');
  return yamlObject(lines);
}


export function attributeToYAML(attribute: AttributeInfo): string[] {
  var lines: string[] = [
    `name: ${attribute.name}`,
    `type: ${attribute.type}`
  ];

  if (attribute.special) {
    lines.push(`special: ${attribute.special}`);
  }

  lines.push('');
  return yamlObject(lines);
}

export function dimensionToYAML(dimension: Dimension): string[] {
  var lines: string[] = [
    `name: ${dimension.name}`,
    `title: ${dimension.title}`
  ];

  if (dimension.kind !== 'string') {
    lines.push(`kind: ${dimension.kind}`);
  }

  lines.push(`expression: ${dimension.expression.toString()}`);

  lines.push('');
  return yamlObject(lines);
}

export function measureToYAML(measure: Measure): string[] {
  var lines: string[] = [
    `name: ${measure.name}`,
    `title: ${measure.title}`
  ];

  var ex = measure.expression;
  lines.push(`expression: ${ex.toString()}`);

  var format = measure.format;
  if (format !== Measure.DEFAULT_FORMAT) {
    lines.push(`format: ${format}`);
  }

  lines.push('');
  return yamlObject(lines);
}

export function dataSourceToYAML(dataSource: DataSource, withComments: boolean): string[] {
  var lines: string[] = [
    `name: ${dataSource.name}`,
    `title: ${dataSource.title}`,
    `clusterName: ${dataSource.clusterName}`,
    `source: ${dataSource.source}`
  ];

  var timeAttribute = dataSource.timeAttribute;
  if (timeAttribute && !(dataSource.clusterName === 'druid' && timeAttribute.name === '__time')) {
    if (withComments) {
      lines.push(`# The primary time attribute of the data refers to the attribute that must always be filtered on`);
      lines.push(`# This is particularly useful for Druid data sources as they must always have a time filter.`);
    }
    lines.push(`timeAttribute: ${timeAttribute.name}`, '');
  }


  var refreshRule = dataSource.refreshRule;
  if (withComments) {
    lines.push("# The refresh rule describes how often the data source looks for new data. Default: 'query'/PT1M (every minute)");
  }
  lines.push(`refreshRule:`);
  lines.push(`  rule: ${refreshRule.rule}`);
  if (refreshRule.time) {
    lines.push(`  time: ${refreshRule.time.toISOString()}`);
  }
  if (refreshRule.refresh) {
    lines.push(`  refresh: ${refreshRule.refresh.toString()}`);
  }
  lines.push('');

  yamlPropAdder(lines, withComments, {
    object: dataSource,
    propName: 'defaultTimezone',
    comment: 'The default timezone for this dataset to operate in defaults to UTC',
    defaultValue: DataSource.DEFAULT_DEFAULT_TIMEZONE
  });

  yamlPropAdder(lines, withComments, {
    object: dataSource,
    propName: 'defaultDuration',
    comment: 'The default duration for the time filter',
    defaultValue: DataSource.DEFAULT_DEFAULT_DURATION
  });

  yamlPropAdder(lines, withComments, {
    object: dataSource,
    propName: 'defaultSortMeasure',
    comment: 'The default sort measure name (if not set the first measure name is used)',
    defaultValue: dataSource.getDefaultSortMeasure()
  });

  var defaultSelectedMeasures = dataSource.defaultSelectedMeasures ? dataSource.defaultSelectedMeasures.toArray() : null;
  if (withComments) {
    lines.push('', "# The names of measures that are selected by default");
  }
  if (defaultSelectedMeasures) {
    lines.push(`defaultSelectedMeasures: ${JSON.stringify(defaultSelectedMeasures)}`);
  } else if (withComments) {
    lines.push(`#defaultSelectedMeasures: []`);
  }


  var defaultPinnedDimensions = dataSource.defaultPinnedDimensions ? dataSource.defaultPinnedDimensions.toArray() : null;
  if (withComments) {
    lines.push('', "# The names of dimensions that are pinned by default (in order that they will appear in the pin bar)");
  }
  if (defaultPinnedDimensions) {
    lines.push('', `defaultPinnedDimensions: ${JSON.stringify(defaultPinnedDimensions)}`);
  } else if (withComments) {
    lines.push('', `#defaultPinnedDimensions: []`);
  }


  var introspection = dataSource.getIntrospection();
  if (withComments) {
    lines.push(
      "",
      "# How the dataset should be introspected",
      "# possible options are:",
      "# * none - Do not do any introspection, take what is written in the config as the rule of law.",
      "# * no-autofill - Introspect the datasource but do not automatically generate dimensions or measures",
      "# * autofill-dimensions-only - Introspect the datasource, automatically generate dimensions only",
      "# * autofill-measures-only - Introspect the datasource, automatically generate measures only",
      "# * autofill-all - (default) Introspect the datasource, automatically generate dimensions and measures"
    );
  }
  lines.push(`introspection: ${introspection}`);


  var attributeOverrides = dataSource.attributeOverrides;
  if (withComments) {
    lines.push('', "# The list of attribute overrides in case introspection get something wrong");
  }
  lines.push('attributeOverrides:');
  if (withComments) {
    lines.push(
      "  # A general attribute override looks like so:",
      "  #",
      "  # name: user_unique",
      "  # ^ the name of the attribute (the column in the database)",
      "  #",
      "  # type: STRING",
      "  # ^ (optional) plywood type of the attribute",
      "  #",
      "  # special: unique",
      "  # ^ (optional) any kind of special significance associated with this attribute",
      ""
    );
  }
  lines = lines.concat.apply(lines, attributeOverrides.map(attributeToYAML));


  var dimensions = dataSource.dimensions.toArray();
  if (withComments) {
    lines.push('', "# The list of dimensions defined in the UI. The order here will be reflected in the UI");
  }
  lines.push('dimensions:');
  if (withComments) {
    lines.push(
      "  # A general dimension looks like so:",
      "  #",
      "  # name: channel",
      "  # ^ the name of the dimension as used in the URL (you should try not to change these)",
      "  #",
      "  # title: The Channel",
      "  # ^ (optional) the human readable title. If not set a title is generated from the 'name'",
      "  #",
      "  # kind: string",
      "  # ^ (optional) the kind of the dimension. Can be 'string', 'time', 'number', or 'boolean'. Defaults to 'string'",
      "  #",
      "  # expression: $channel",
      "  # ^ (optional) the Plywood bucketing expression for this dimension. Defaults to '$name'",
      "  #   if, say, channel was called 'cnl' in the data you would put '$cnl' here",
      "  #   See also the expressions API reference: https://plywood.imply.io/expressions",
      "  #",
      "  # url: string",
      "  # ^ (optional) a url (including protocol) associated with the dimension, with optional token '%s'",
      "  #   that is replaced by the dimension value to generate links specific to each value.",
      ""
    );
  }
  lines = lines.concat.apply(lines, dimensions.map(dimensionToYAML));
  if (withComments) {
    lines.push(
      "  # This is the place where you might want to add derived dimensions.",
      "  #",
      "  # Here are some examples of possible derived dimensions:",
      "  #",
      "  # - name: is_usa",
      "  #   title: Is USA?",
      "  #   expression: $country == 'United States'",
      "  #",
      "  # - name: file_version",
      "  #   expression: $filename.extract('(\\d+\\.\\d+\\.\\d+)')",
      ""
    );
  }


  var measures = dataSource.measures.toArray();
  if (withComments) {
    lines.push('', "# The list of measures defined in the UI. The order here will be reflected in the UI");
  }
  lines.push(`measures:`);
  if (withComments) {
    lines.push(
      "  # A general measure looks like so:",
      "  #",
      "  # name: avg_revenue",
      "  # ^ the name of the dimension as used in the URL (you should try not to change these)",
      "  #",
      "  # title: Average Revenue",
      "  # ^ (optional) the human readable title. If not set a title is generated from the 'name'",
      "  #",
      "  # expression: $main.sum($revenue) / $main.sum($volume) * 10",
      "  # ^ (optional) the Plywood bucketing expression for this dimension.",
      "  #   Usually defaults to '$main.sum($name)' but if the name contains 'min' or 'max' will use that as the aggregate instead of sum.",
      "  #   this is the place to define your fancy formulas",
      ""
    );
  }
  lines = lines.concat.apply(lines, measures.map(measureToYAML));
  if (withComments) {
    lines.push(
      "  # This is the place where you might want to add derived measures (a.k.a Post Aggregators).",
      "  #",
      "  # Here are some examples of possible derived measures:",
      "  #",
      "  # - name: ecpm",
      "  #   title: eCPM",
      "  #   expression: $main.sum($revenue) / $main.sum($impressions) * 1000",
      "  #",
      "  # - name: usa_revenue",
      "  #   title: USA Revenue",
      "  #   expression: $main.filter($country == 'United States').sum($revenue)",
      ""
    );
  }

  lines.push('');
  return yamlObject(lines);
}
