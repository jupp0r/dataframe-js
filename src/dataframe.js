import { match, transpose, chain, iter, arrayEqual } from './reusables.js';
import { InputTypeError, NotTheSameSchemaError } from './errors.js';
import Row from './row.js';

/**
 * DataFrame data structure providing an immutable, flexible and powerfull way to manipulate data with columns and rows.
 */
class DataFrame {
    /**
     * Create a new DataFrame.
     * @param {Array | Object | DataFrame} data The data of the DataFrame.
     * @param {Array} columns The DataFrame column names.
     * @param {...Object} [modules] Additional modules.
     * @example
     * // From Object
     * const dfFromObjectOfArrays = new DataFrame({
    *      'column1': [3, 6, 8],  // Column Data
    *      'column2': [3, 4, 5, 6], // Column Data
     * }, ['column1', 'column2']); // Columns
     *
     * // From Array of Arrays
     * const dfFromArrayOfArrays = new DataFrame([
    *      [1, 6, 9, 10, 12],  // Row Data
    *      [1, 2],             // Row Data
    *      [6, 6, 9, 8, 9, 12], // Row Data
     * ], ['c1', 'c2', 'c3', 'c4', 'c5', 'c6']); // Columns
     *
     * // From Array of Objects -- THE BETTER WAY --
     * const dfFromArrayOfObjects = new DataFrame([
    *      {c1: 1, c2: 6, c3: 9, c4: 10, c5: 12},  // Row Data
    *      {c4: 1, c3: 2},                         // Row Data
    *      {c1: 6, c5: 6, c2: 9, c4: 8, c3: 9, c6: 12}, // Row Data
     * ], ['c1', 'c2', 'c3', 'c4', 'c5', 'c6']); // Columns
     *
     * // From DataFrame
     * const dfFromDF = new DataFrame(dfFromArrayOfArrays);
     */
    constructor(data, columns, ...modules) {
        [this.__rows__, this.columns] = this._build(data, columns);
        this.modules = modules;
        if (modules.length > 0) {
            Object.assign(this, ...modules.map(Plugin => {
                const pluginInstance = new Plugin(this);
                return {[pluginInstance.name]: pluginInstance};
            }));
        }
    }

    * [Symbol.iterator]() {
        for (const row of this.__rows__) {
            yield row;
        }
    }

    __newInstance__(data, columns) {
        return new DataFrame(data, columns, ...this.modules);
    }

    _build(data, columns) {
        return match(data,
                [(value) => (value instanceof DataFrame), () => [data.__rows__, data.columns]],
                [(value) => (value instanceof Array), () => this._fromArray(data, columns)],
                [(value) => (value instanceof Object), () => this._fromDict(data, columns)],
                [() => true, () => {throw new InputTypeError(typeof data, ['Object', 'Array']);}]);
    }

    _fromDict(dict, columns) {
        return [transpose(Object.values(dict)).map(row => new Row(row, columns)), columns];
    }

    _fromArray(array, columns) {
        return [array.map(row => new Row(row, columns)), columns];
    }

    /**
     * Convert DataFrame into dict / hash / object.
     * @returns {Object} The DataFrame converted into dict.
     * @example
     * df.toDict()
     *
     * { c1: [ 1, undefined, 6 ], // one array by column
     *   c2: [ 6, undefined, 9 ],
     *   c3: [ 9, 2, 9 ],
     *   c4: [ 10, 1, 8 ],
     *   c5: [ 12, undefined, 6 ],
     *   c6: [ undefined, undefined, 12 ] }
     */
    toDict() {
        return Object.assign({}, ...Object.entries(
            transpose([...this.__rows__].map(row => row.toArray()))
        ).map(([index, column]) => ({[this.columns[index]]: column})));
    }

    /**
     * Convert DataFrame into Array.
     * @returns {Array} The DataFrame converted into dict.
     * @example
     * df.toArray()
     *
     * [ [ 1, 6, 9, 10, 12, undefined ], // one array by row
     *   [ undefined, undefined, 2, 1, undefined, undefined ],
     *   [ 6, 9, 9, 8, 6, 12 ] ]
     */
    toArray() {
        return [...this].map(row => row.toArray());
    }

    /**
     * Display the DataFrame as String Table. Can only return a sring instead of displaying the DataFrame.
     * @param {Number} [rows=10] The number of lines to display.
     * @param {Boolean} [quiet=false] Quiet mode. If true, only returns a string instead of console.log().
     * @returns {String} The DataFrame as String Table.
     * @example
     * df.show() // console.log the DataFrame with the first 10nth rows
     *
     * | column1   | column2   | column3   |
     * ------------------------------------
     * | 3         | 3         | undefined |
     * | 6         | 4         | undefined |
     * | 8         | 5         | undefined |
     * | undefined | 6         | undefined |
     */
    show(rows = 10, quiet = false) {
        const makeRow = (row) => (
            `| ${row.map(
                column => String(column).substring(0, 10) + Array(10 - String(column).length).join(' ')
            ).join(' | ')} |`
        );
        const header = makeRow(this.columns);
        const toShow = [
            header,
            Array(header.length).join('-'),
            ...iter(this.__rows__, row => makeRow(row.toArray()), rows),
        ].join('\n');
        if (!quiet) {console.log(toShow);}
        return toShow;
    }

    /**
     * Get the DataFrame dimensions.
     * @returns {Array} The DataFrame dimensions. [height, weight]
     * @example
     * df.dim()
     * [4, 3] // [height, weight]
     */
    dim() {
        return [this.count(), this.columns.length];
    }

    /**
     * Get the rows number.
     * @returns {Int} The number of DataFrame rows.
     * @example
     * // Counting rows
     * df.count()
     *
     * 4
     */
    count() {
        return [...this].length;
    }

    /**
     * Get the count of a value into a column.
     * @param valueToCount The value to count into the selected column.
     * @param {String} [columnName=this.columns[0]] The column where found the value.
     * @returns {Int} The number of times the selected value appears.
     * @example
      * // Counting specific value in a column
      * df.countValue(5, 'column2')
      *
      * 1
      *
      * // Counting specific value in a selected column
      * df.select('column1').countValue(5)
      *
      * 0
     */
    countValue(valueToCount, columnName = this.columns[0]) {
        return this.filter(row => row.get(columnName) === valueToCount).count();
    }

    /**
     * Compute unique values into a column.
     * @param {String} columnName The column to distinct.
     * @returns {Array} An Array containing distinct values of the column.
     * @example
     * df.distinct('d2')
     *
     * [3, 4, 15, 6]
     */
    distinct(columnName) {
        return [...new Set(...transpose(this.select(columnName).toArray()))];
    }

    /**
     * Select columns in the DataFrame.
     * @param {...String} columnNames The columns to select.
     * @returns {DataFrame} A new DataFrame containing selected columns.
     * @example
     * df.select('column1', 'column3').show()
     *
     * | column1   | column3   |
     * ------------------------
     * | 3         | undefined |
     * | 6         | undefined |
     * | 8         | undefined |
     * | undefined | undefined |
     */
    select(...columnNames) {
        return this.__newInstance__(this.__rows__.map(
            row => row.select(...columnNames)
        ), columnNames);
    }

    /**
     * Add a new column or set an existing one.
     * @param {String} columnName The column to modify or to create.
     * @param {Function} [func=(row, index) => undefined] The function to create the column.
     * @returns {DataFrame} A new DataFrame containing the new or modified column.
     * @example
     * // Add a new column
     * df.withColumn('column4', () => 2).show()
     *
     * | column1   | column2   | column3   | column4   |
     * ------------------------------------------------
     * | 3         | 3         | undefined | 2         |
     * | 6         | 4         | undefined | 2         |
     * | 8         | 5         | undefined | 2         |
     * | undefined | 6         | undefined | 2         |
     *
     * // Modify a column
     * df.withColumn('column2', (row) => row.get('column2') * 2).show()
     *
     * | column1   | column2   | column3   |
     * ------------------------------------
     * | 3         | 6         | undefined |
     * | 6         | 8         | undefined |
     * | 8         | 10        | undefined |
     * | undefined | 12        | undefined |
     */
    withColumn(columnName, func = () => undefined) {
        return this.__newInstance__(this.__rows__.map(
            (row, index) => {
                return row.set(columnName, func(row, index));
            }
        ), this.columns.includes(columnName) ? this.columns : [...this.columns, columnName]);
    }

    /**
     * Modify the structure of the DataFrame by changing columns order, creating new columns or removing some columns.
     * @param {...String} columnNames The new columns of the DataFrame.
     * @returns {DataFrame} A new DataFrame with different columns (renamed, add or deleted).
     * @example
     * df.columns
     *
     * ['column1', 'column2', 'column3']
     *
     * // Adding one empty column and removing one
     * df.restructure('column1', 'column3', 'column4')
     *
     * | column1   | column3   | column4   |
     * ------------------------------------
     * | 3         | undefined | undefined |
     * | 6         | undefined | undefined |
     * | 8         | undefined | undefined |
     * | undefined | undefined | undefined |
     */
    restructure(...columnNames) {
        return this.__newInstance__(this.__rows__, columnNames);
    }

    /**
     * Rename columns.
     * @param {...String} columnNames The new column names of the DataFrame.
     * @returns {DataFrame} A new DataFrame with the new column names.
     * @example
     * df.columns
     *
     * ['column1', 'column2', 'column3']
     *
     * df.rename('column1', 'column3', 'column4').columns
     *
     * ['column1', 'column3', 'column4']
     */
    rename(...columnNames) {
        return this.__newInstance__(this.__rows__.map(row => row.toArray()), columnNames);
    }

    /**
     * Remove a single column.
     * @param {String} columnName The column to drop.
     * @returns {DataFrame} A new DataFrame without the dropped column.
     * @example
     * df.drop('d2').show()
     *
     * | column1   | column3   |
     * ------------------------
     * | 3         | undefined |
     * | 6         | undefined |
     * | 8         | undefined |
     * | undefined | undefined |
     */
    drop(columnName) {
        return this.__newInstance__(this.__rows__.map(
            (row) => row.delete(columnName)
        ), this.columns.filter(column => column !== columnName));
    }

    /**
     * Chain multiple functions on DataFrame (filters, maps) and optimized their executions.
     * If a function returns boolean, it's a filter. Else it's a map.
     * It can be 10 - 100 x faster than standard chains of .map() and .filter().
     * @param {...Function} funcs Functions to apply on the DataFrame rows taking the row as parameter.
     * @returns {DataFrame} A new DataFrame with modified rows.
     * @example
     * // 1 filter ==> 1 map ==> 1 filter
     * df.chain(
    *      line => line.get('column1') > 3, // Filter sending boolean. If true the chain continue. Else it breaks and the row is not send.
    *      line => line.set('column1', 3),  // Map sending modification
    *      line => line.get('column2') === '5' // Filter sending boolean. If true the row is send.
     * ).show();
     *
     * | column1   | column2   | column3   |
     * ------------------------------------
     * | 3         | 5         | undefined |
     */
    chain(...funcs) {
        return this.__newInstance__([...chain(this.__rows__, ...funcs)], this.columns);
    }

    /**
     * Filter DataFrame rows. /!\ Prefer to use .chain().
     * @param {Function} func A function sending a boolean taking the row as parameter.
     * @returns {DataFrame} A new filtered DataFrame.
     */
    filter(func) {
        const filteredRows = [...iter(this.__rows__, row => func(row) ? row : false)];
        return filteredRows.length > 0 ? this.__newInstance__(filteredRows, this.columns) : this.__newInstance__([], []);
    }

    /**
     * Map on DataFrame rows. /!\ Prefer to use .chain().
     * @param {Function} func A function to apply on each row taking the row as parameter.
     * @returns {DataFrame} A new DataFrame with modified rows.
     */
    map(func) {
        return this.__newInstance__([...iter(this.__rows__, row => func(row))], this.columns);
    }

    /**
     * Reduce DataFrame into a value.
     * @param {Function} func The reduce function taking 2 parameters, previous and next.
     * @param [init] The initial value of the reducer.
     * @returns A reduced value.
     * @example
     * // Compute a value from rows, starting from value 0
     * df.reduce((p, n) => n.get('column1') + p, 0)
     *
     * // Compute a row from rows
     * df2.reduce((p, n) => (
    *          n.set('column1', p.get('column1') + n.get('column1'))
    *           .set('column2', p.get('column2') + n.get('column2'))
     * ))
     */
    reduce(func, init) {
        return typeof init === 'undefined' ? this.__rows__.reduce((p, n) => func(p, n)) :
         this.__rows__.reduce((p, n) => func(p, n), init);
    }

    /**
     * Reduce DataFrame into a value, starting from the last row (see .reduce()).
     * @param {Function} func The reduce function taking 2 parameters, previous and next.
     * @param [init] The initial value of the reducer.
     * @returns A reduced value.
     */
    reduceRight(func, init) {
        return typeof init === 'undefined' ? this.__rows__.reduceRight((p, n) => func(p, n)) :
         this.__rows__.reduceRight((p, n) => func(p, n), init);
    }

    /**
     * Group DataFrame rows by a column values.
     * @param {String} columnName The column giving groups (distinct values).
     * @returns {Array} An Array containing a DataFrame by group. The group value can be accessed via df.group.
     * @example
     * // Group By id and return an object containing group and dataframe
     * df.groupBy('id').map(dfByValue => ({group: dfByValue.group, df: dfByValue.toDict()}))
     *
     * [ { group: 3, df: { id: [Object], value: [Object] } },
     *   { group: 6, df: { id: [Object], value: [Object] } },
     *   { group: 8, df: { id: [Object], value: [Object] } },
     *   { group: 1, df: { id: [Object], value: [Object] } } ]
     *
     * // Get sum of value by id with a simple formating
     * df.groupBy('id').map(dfByValue => (
    *      {group: dfByValue.group, result: dfByValue.reduce((p, n) => p + n.get('value'), 0)})
     * )
     *
     * [ { group: 3, result: 3 },
     *   { group: 6, result: 0 },
     *   { group: 8, result: 5 },
     *   { group: 1, result: 2 } ]
     */
    groupBy(columnName) {
        return [...iter(
            this.distinct(columnName),
            (value) => {
                const groupedDF = this.filter(row => row.get(columnName) === value);
                groupedDF.group = value;
                return groupedDF;
            }
        )];
    }

    /**
     * Sort DataFrame rows based on a column values.
     * @param {String} columnName The column giving order.
     * @param {Boolean} [reverse=false] Reverse mode. Reverse the order if true.
     * @returns {DataFrame} An ordered DataFrame.
     * @example
     * // Sort DataFrame by id
     * df.sortBy('id').toArray()
     *
     * [
    *      [1, 1],
    *      [1, 1],
    *      [3, 1],
    *      [3, 2],
    *      [6, 0],
    *      [8, 1],
    *      [8, 4],
     * ]
     *
     * // Sort DataFrame by id and reverse
     * df.sortBy('id', true).toArray()
     *
     * [
    *      [8, 4],
    *      [8, 1],
    *      [6, 0],
    *      [3, 2],
    *      [3, 1],
    *      [1, 1],
    *      [1, 1],
     * ]
     */
    sortBy(columnName, reverse = false) {
        const sortedRows = this.__rows__.sort((p, n) => p.get(columnName) - n.get(columnName));
        return this.__newInstance__(reverse ? sortedRows.reverse() : sortedRows, this.columns);
    }

    /**
     * Concat two DataFrames.
     * @param {DataFrame} dfToUnion The DataFrame to concat.
     * @returns {DataFrame} A new DataFrame resulting of the union.
     * @example
     * df.union(df2).toArray()
     *
     * [
    *      [8, 4],
    *      [8, 1],
    *      [6, 0],
    *      [3, 2],
    *      [3, 1],
    *      [1, 1],
    *      [1, 1],
    *      [3, 1],
    *      [1, 0],
    *      [8, 1],
     * ]
     */
    union(dfToUnion) {
        if (!arrayEqual(this.columns, dfToUnion.columns)) {
            throw new NotTheSameSchemaError(dfToUnion.columns, this.columns);
        }
        return this.__newInstance__([...this, ...dfToUnion], this.columns);
    }

    /**
     * Join two DataFrames.
     * @param {DataFrame} dfToJoin The DataFrame to join.
     * @param {String} on The selected column for the join.
     * @param {String} [how='full'] The join mode. Can be: full, inner, outer, left, right.
     * @returns {DataFrame} The joined DataFrame.
     */
    join(dfToJoin, on, how = 'full') {
        const joinMethods = {
            inner: () => this.innerJoin(dfToJoin, on),
            full: () => this.fullJoin(dfToJoin, on),
            outer: () => this.outerJoin(dfToJoin, on),
            left: () => this.leftJoin(dfToJoin, on),
            right: () => this.rightJoin(dfToJoin, on),
        };
        return joinMethods[how]();
    }

    /**
     * Join two DataFrames with inner mode.
     * @param {DataFrame} dfToJoin The DataFrame to join.
     * @param {String} on The selected column for the join.
     * @returns {DataFrame} The joined DataFrame.
     * @example
     * df1.join(df2, 'id', 'inner')
     *
     * | id        | value     | value2    |
     * ------------------------------------
     * | 3         | 1         | undefined |
     * | 1         | 0         | undefined |
     * | 8         | 1         | undefined |
     * | 1         | undefined | 0         |
     * | 8         | undefined | 2         |
     * | 3         | undefined | 6         |
     */
    innerJoin(dfToJoin, on) {
        const newColumns = [...new Set([...this.columns, ...dfToJoin.columns])];
        const actualGroupedDFs = this.groupBy(on);
        const groupedDFsToJoin = dfToJoin.groupBy(on);
        return [...iter([
            ...actualGroupedDFs.filter(
                groupedDF => !(typeof groupedDFsToJoin.find(df => df.group === groupedDF.group) === 'undefined')
            ),
            ...groupedDFsToJoin.filter(
                groupedDF => !(typeof actualGroupedDFs.find(df => df.group === groupedDF.group) === 'undefined')
            ),
        ], groupedDF => groupedDF.restructure(...newColumns))].reduce((p, n) => p.union(n));
    }

    /**
     * Join two DataFrames with full mode.
     * @param {DataFrame} dfToJoin The DataFrame to join.
     * @param {String} on The selected column for the join.
     * @returns {DataFrame} The joined DataFrame.
     * @example
     * df1.join(df2, 'id', 'full')
     *
     * | id        | value     | value2    |
     * ------------------------------------
     * | 3         | 1         | undefined |
     * | 1         | 0         | undefined |
     * | 8         | 1         | undefined |
     * | 2         | undefined | 1         |
     * | 1         | undefined | 0         |
     * | 6         | undefined | 1         |
     * | 8         | undefined | 2         |
     * | 3         | undefined | 6         |
     */
    fullJoin(dfToJoin, on) {
        const newColumns = [...new Set([...this.columns, ...dfToJoin.columns])];
        return [...iter([
            ...this.groupBy(on), ...dfToJoin.groupBy(on),
        ], groupedDF => groupedDF.restructure(...newColumns))].reduce((p, n) => p.union(n));
    }

    /**
     * Join two DataFrames with outer mode.
     * @param {DataFrame} dfToJoin The DataFrame to join.
     * @param {String} on The selected column for the join.
     * @returns {DataFrame} The joined DataFrame.
     * @example
     * df1.join(df2, 'id', 'outer')
     *
     * | id        | value     | value2    |
     * ------------------------------------
     * | 2         | undefined | 1         |
     * | 6         | undefined | 1         |
     */
    outerJoin(dfToJoin, on) {
        const newColumns = [...new Set([...this.columns, ...dfToJoin.columns])];
        const actualGroupedDFs = this.groupBy(on);
        const groupedDFsToJoin = dfToJoin.groupBy(on);
        return [...iter([
            ...actualGroupedDFs.filter(
                groupedDF => typeof groupedDFsToJoin.find(df => df.group === groupedDF.group) === 'undefined'
            ),
            ...groupedDFsToJoin.filter(
                groupedDF => typeof actualGroupedDFs.find(df => df.group === groupedDF.group) === 'undefined'
            ),
        ], groupedDF => groupedDF.restructure(...newColumns))].reduce((p, n) => p.union(n));
    }

    /**
     * Join two DataFrames with left mode.
     * @param {DataFrame} dfToJoin The DataFrame to join.
     * @param {String} on The selected column for the join.
     * @returns {DataFrame} The joined DataFrame.
     * @example
     * df1.join(df2, 'id', 'left')
     *
     * | id        | value     | value2    |
     * ------------------------------------
     * | 3         | 1         | undefined |
     * | 1         | 0         | undefined |
     * | 8         | 1         | undefined |
     * | 1         | undefined | 0         |
     * | 8         | undefined | 2         |
     * | 3         | undefined | 6         |
     */
    leftJoin(dfToJoin, on) {
        const newColumns = [...new Set([...this.columns, ...dfToJoin.columns])];
        const actualGroupedDFs = this.groupBy(on);
        const groupedDFsToJoin = dfToJoin.groupBy(on);
        return [...iter([
            ...actualGroupedDFs,
            ...groupedDFsToJoin.filter(
                groupedDF => !(typeof actualGroupedDFs.find(df => df.group === groupedDF.group) === 'undefined')
            ),
        ], groupedDF => groupedDF.restructure(...newColumns))].reduce((p, n) => p.union(n));
    }

    /**
     * Join two DataFrames with right mode.
     * @param {DataFrame} dfToJoin The DataFrame to join.
     * @param {String} on The selected column for the join.
     * @returns {DataFrame} The joined DataFrame.
     * @example
     * df1.join(df2, 'id', 'right')
     *
     * | id        | value     | value2    |
     * ------------------------------------
     * | 2         | undefined | 1         |
     * | 1         | undefined | 0         |
     * | 6         | undefined | 1         |
     * | 8         | undefined | 2         |
     * | 3         | undefined | 6         |
     * | 3         | 1         | undefined |
     * | 1         | 0         | undefined |
     * | 8         | 1         | undefined |
     */
    rightJoin(dfToJoin, on) {
        const newColumns = [...new Set([...this.columns, ...dfToJoin.columns])];
        const actualGroupedDFs = this.groupBy(on);
        const groupedDFsToJoin = dfToJoin.groupBy(on);
        return [...iter([
            ...groupedDFsToJoin,
            ...actualGroupedDFs.filter(
                groupedDF => !(typeof groupedDFsToJoin.find(df => df.group === groupedDF.group) === 'undefined')
            ),
        ], groupedDF => groupedDF.restructure(...newColumns))].reduce((p, n) => p.union(n));
    }
}

export default DataFrame;
